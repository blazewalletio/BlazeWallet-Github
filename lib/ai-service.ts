// AI Service - Central AI functionality for BlazeWallet
import { ethers } from 'ethers';
import { logger } from '@/lib/logger';

export interface AIResponse {
  success: boolean;
  message: string;
  action?: {
    type: 'send' | 'swap' | 'info' | 'none';
    params?: any;
  };
  confidence: number;
  warnings?: string[];
}

export interface TransactionIntent {
  type: 'send' | 'swap' | 'receive' | 'info';
  amount?: string;
  token?: string;
  recipient?: string;
  fromToken?: string;
  toToken?: string;
}

class AIService {
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private lastApiCall: number = 0;
  private readonly RATE_LIMIT_MS = 5000; // 5 seconds between calls (increased)
  private retryCount: number = 0;
  private readonly MAX_RETRIES = 2; // Reduced retries to avoid long waits

  private checkRateLimit(): boolean {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    
    if (timeSinceLastCall < this.RATE_LIMIT_MS) {
      const waitTime = this.RATE_LIMIT_MS - timeSinceLastCall;
      logger.log(`⏰ Rate limit: please wait ${Math.ceil(waitTime / 1000)} seconds`);
      return false;
    }
    
    this.lastApiCall = now;
    return true;
  }

  private isRecentFailure(): boolean {
    // Check if we had a recent 429 error within the last 30 seconds
    const recentFailure = localStorage.getItem('ai_recent_429');
    if (recentFailure) {
      const failureTime = parseInt(recentFailure);
      const now = Date.now();
      if (now - failureTime < 30000) { // 30 seconds
        logger.log('🚫 Recent 429 error detected, waiting longer...');
        return true;
      } else {
        localStorage.removeItem('ai_recent_429');
      }
    }
    return false;
  }

  private recordFailure(): void {
    localStorage.setItem('ai_recent_429', Date.now().toString());
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 2): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        if (error.message?.includes('Te veel requests')) {
          // Record the failure for future calls
          this.recordFailure();
          
          if (attempt < maxRetries) {
            const backoffMs = Math.pow(2, attempt + 2) * 1000; // Exponential backoff: 8s, 16s
            logger.log(`⏳ Retry ${attempt}/${maxRetries} in ${backoffMs/1000}s...`);
            await this.sleep(backoffMs);
            continue;
          }
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }

  // Parse natural language transaction commands
  parseTransactionIntent(input: string, context: any): TransactionIntent | null {
    const lowerInput = input.toLowerCase();
    
    // Send patterns
    const sendPatterns = [
      /(?:stuur|send|verstuur|transfer)\s+(\d+(?:\.\d+)?)\s*(\w+)?\s+(?:naar|to)\s+(.+)/i,
      /(?:stuur|send|verstuur)\s+(.+)\s+(\d+(?:\.\d+)?)\s*(\w+)?/i,
    ];

    // Swap patterns
    const swapPatterns = [
      /(?:swap|wissel|ruil)\s+(\d+(?:\.\d+)?)\s*(\w+)?\s+(?:naar|to|for)\s+(\w+)/i,
      /(?:swap|wissel|ruil)\s+(?:al mijn|all my|alle)\s+(\w+)\s+(?:naar|to|for)\s+(\w+)/i,
    ];

    // Info patterns
    const infoPatterns = [
      /(?:wat is|what is|hoeveel|how much)\s+(.+)/i,
      /(?:toon|show|display)\s+(.+)/i,
    ];

    // Try to match send patterns
    for (const pattern of sendPatterns) {
      const match = input.match(pattern);
      if (match) {
        return {
          type: 'send',
          amount: match[1],
          token: match[2] || 'ETH',
          recipient: match[3],
        };
      }
    }

    // Try to match swap patterns
    for (const pattern of swapPatterns) {
      const match = input.match(pattern);
      if (match) {
        if (match[0].includes('al mijn') || match[0].includes('all my')) {
          return {
            type: 'swap',
            amount: 'max',
            fromToken: match[1],
            toToken: match[2],
          };
        }
        return {
          type: 'swap',
          amount: match[1],
          fromToken: match[2] || 'ETH',
          toToken: match[3],
        };
      }
    }

    // Info request
    for (const pattern of infoPatterns) {
      const match = input.match(pattern);
      if (match) {
        return {
          type: 'info',
        };
      }
    }

    return null;
  }

  // AI-powered transaction assistant
  async processTransactionCommand(
    input: string,
    context: {
      balance: string;
      tokens: any[];
      address: string;
      chain: string;
    }
  ): Promise<AIResponse> {
    try {
      logger.log('🤖 [AI Service] Processing command:', input.substring(0, 50));

      // Get user ID for rate limiting (prefer Supabase auth, fallback to email/anonymous)
      let userId = 'anonymous';
      
      if (typeof window !== 'undefined') {
        // Priority 1: Supabase authenticated user ID (SECURE - cannot be manipulated)
        const supabaseUserId = localStorage.getItem('supabase_user_id');
        if (supabaseUserId && supabaseUserId !== 'null') {
          userId = supabaseUserId;
          logger.log('🔐 [AI Service] Using Supabase user ID for rate limiting');
        }
        // Priority 2: Email (less secure, but better than nothing)
        else {
          const walletEmail = localStorage.getItem('wallet_email');
          if (walletEmail && walletEmail !== 'null') {
            userId = walletEmail;
            logger.log('📧 [AI Service] Using email for rate limiting');
          } else {
            logger.log('👤 [AI Service] Using anonymous for rate limiting (no auth)');
          }
        }
      }

      logger.log('🆔 [AI Service] Rate limit userId:', userId.substring(0, 20) + '...');

      // Build conversation history for API (only last 5 exchanges = 10 messages max)
      const conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];
      
      // We'll pass conversation from component later, for now empty
      // This will be populated by AITransactionAssistant component

      // Call our backend API (which handles caching + OpenAI)
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input,
          context: {
            chain: context.chain,
            balance: context.balance,
            tokens: context.tokens.map(t => ({
              symbol: t.symbol,
              balance: t.balance,
              usdValue: t.usdValue
            })),
            address: context.address
          },
          userId: userId,
          conversationHistory: (context as any).conversationHistory || [] // ✅ NEW: Pass conversation history
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit exceeded
          const data = await response.json();
          return {
            success: false,
            message: data.message || 'You have reached your daily limit of 50 AI queries. Try again tomorrow.',
            confidence: 0,
          };
        }

        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      logger.log('✅ [AI Service] Response:', {
        intent: data.intent,
        cached: data.cached,
        source: data.source
      });

      // Convert API response to our format
      const result: AIResponse = {
        success: true,
        message: data.message,
        confidence: data.confidence || 0.95,
      };

      // Map intent to action
      if (data.intent === 'send' && data.params) {
        result.action = {
          type: 'send',
          params: {
            amount: data.params.amount,
            token: data.params.token || 'ETH',
            recipient: data.params.to
          }
        };
      } else if (data.intent === 'swap' && data.params) {
        result.action = {
          type: 'swap',
          params: {
            fromToken: data.params.fromToken,
            toToken: data.params.toToken,
            amount: data.params.amount
          }
        };
      } else if (data.intent === 'info') {
        result.action = {
          type: 'info',
          params: {}
        };
      } else if (data.intent === 'clarify' && data.needsClarification) {
        result.success = false;
        result.message = data.clarificationQuestion || data.message;
      } else {
        result.action = {
          type: 'none',
          params: {}
        };
      }

      // Add warnings if present
      if (data.warnings && data.warnings.length > 0) {
        result.message += '\n\n' + data.warnings.join('\n');
      }

      return result;

    } catch (error: any) {
      logger.error('❌ [AI Service] Error:', error);

      // Fallback to simple pattern matching
      const intent = this.parseTransactionIntent(input, context);
      
      if (intent && intent.type === 'send' && intent.amount && intent.recipient) {
        return {
          success: true,
          message: `Send ${intent.amount} ${intent.token} to ${intent.recipient}`,
          action: {
            type: 'send',
            params: {
              amount: intent.amount,
              token: intent.token,
              recipient: intent.recipient,
            },
          },
          confidence: 0.7,
        };
      }

      return {
        success: false,
        message: 'I couldn\'t process your command. Please try again or rephrase it.',
        confidence: 0,
      };
    }
  }

  // Smart contract and address risk analysis
  async analyzeRisk(address: string, type: 'contract' | 'wallet' = 'contract'): Promise<{
    risk: 'low' | 'medium' | 'high' | 'critical';
    warnings: string[];
    score: number;
    details: string;
    chainType?: string;
    chainName?: string;
  }> {
    try {
      const { addressValidator } = await import('./address-validator');
      const { securityAPI } = await import('./security-api');
      
      logger.log(`🔍 [AI Service] Starting risk analysis for: ${address.substring(0, 10)}...`);
      
      // Step 1: Validate address and detect chain
      const validation = addressValidator.validate(address);
      
      if (!validation.isValid) {
        logger.error(`❌ [AI Service] Invalid address:`, validation.error);
        return {
          risk: 'critical',
          warnings: [validation.error || 'Invalid address format'],
          score: 0,
          details: 'This is not a valid blockchain address. Please check the address and try again.',
        };
      }
      
      logger.log(`✅ [AI Service] Address valid - Chain: ${validation.chainType}`);
      
      const chainName = addressValidator.getChainName(validation.chainType!);
      
      // Step 2: Perform comprehensive security check
      const securityCheck = await securityAPI.performComprehensiveCheck(
        validation.normalizedAddress,
        validation.chainType!,
        type
      );
      
      logger.log(`📊 [AI Service] Security score: ${securityCheck.riskScore}/100`);
      logger.log(`⚠️  [AI Service] Warnings:`, securityCheck.warnings.length);
      
      // Step 3: Determine risk level from score
      let risk: 'low' | 'medium' | 'high' | 'critical';
      if (securityCheck.isScam || securityCheck.riskScore < 30) {
        risk = 'critical';
      } else if (securityCheck.riskScore >= 80) {
        risk = 'low';
      } else if (securityCheck.riskScore >= 60) {
        risk = 'medium';
      } else {
        risk = 'high';
      }
      
      // Step 4: Build detailed explanation
      const details = this.getRiskDetails(risk, securityCheck.warnings);
      
      logger.log(`🎯 [AI Service] Final risk: ${risk} (${securityCheck.riskScore}/100)`);
      
      return {
        risk,
        warnings: securityCheck.warnings,
        score: securityCheck.riskScore,
        details,
        chainType: validation.chainType!,
        chainName,
      };
      
    } catch (error) {
      logger.error('❌ [AI Service] Risk analysis error:', error);
      return {
        risk: 'medium',
        warnings: ['Could not complete full security analysis'],
        score: 50,
        details: 'Something went wrong during the security check. Please try again or proceed with caution.',
      };
    }
  }

  private getRiskDetails(risk: string, warnings: string[]): string {
    switch (risk) {
      case 'low':
        return '✅ This looks like a safe transaction. You can proceed.';
      case 'medium':
        return '⚠️ Be careful. Double-check the address before proceeding.';
      case 'high':
        return '🚨 High risk detected! Consider not doing this transaction.';
      case 'critical':
        return '🛑 STOP! This is probably a scam or wrong address. Do NOT proceed.';
      default:
        return 'Risk unknown.';
    }
  }

  // Portfolio analysis and recommendations
  analyzePortfolio(tokens: any[], totalValue: number): {
    insights: string[];
    recommendations: string[];
    riskScore: number;
  } {
    const insights: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 50; // Start at medium risk

    if (tokens.length === 0) {
      return {
        insights: ['Your portfolio is empty'],
        recommendations: ['Start by adding crypto assets'],
        riskScore: 0,
      };
    }

    // Diversification analysis
    const largestHolding = tokens[0];
    const largestPercentage = (parseFloat(largestHolding.usdValue) / totalValue) * 100;

    if (largestPercentage > 80) {
      insights.push(`💎 ${largestPercentage.toFixed(0)}% van je portfolio zit in ${largestHolding.symbol}`);
      recommendations.push('Overweeg te diversifiëren naar andere assets voor lagere risico');
      riskScore += 20;
    } else if (largestPercentage > 50) {
      insights.push(`Je grootste holding is ${largestHolding.symbol} (${largestPercentage.toFixed(0)}%)`);
      riskScore += 10;
    } else {
      insights.push('✅ Goed gediversifieerde portfolio');
      riskScore -= 10;
    }

    // Stablecoin allocation
    const stablecoins = tokens.filter(t => 
      ['USDT', 'USDC', 'DAI', 'BUSD'].includes(t.symbol.toUpperCase())
    );
    const stableValue = stablecoins.reduce((sum, t) => sum + parseFloat(t.usdValue || '0'), 0);
    const stablePercentage = (stableValue / totalValue) * 100;

    if (stablePercentage < 10) {
      insights.push('⚠️ Je hebt weinig stablecoins voor volatiliteit bescherming');
      recommendations.push('Overweeg 10-20% in stablecoins aan te houden als buffer');
      riskScore += 15;
    } else if (stablePercentage > 70) {
      insights.push('💵 Veel stablecoins - conservatieve strategie');
      recommendations.push('Als je meer risico aankan, overweeg exposure naar growth assets');
      riskScore -= 15;
    } else {
      insights.push(`✅ Gezonde stablecoin allocatie (${stablePercentage.toFixed(0)}%)`);
    }

    // Portfolio size recommendations
    if (totalValue < 100) {
      recommendations.push('💡 Begin klein en leer de basics voordat je meer investeert');
    } else if (totalValue > 10000) {
      recommendations.push('💼 Overweeg hardware wallet voor extra security bij grote bedragen');
    }

    // Token count
    if (tokens.length > 15) {
      insights.push('📊 Je hebt veel verschillende tokens');
      recommendations.push('Overweeg te consolideren naar je top holdings voor beter overzicht');
    }

    return {
      insights,
      recommendations,
      riskScore: Math.min(Math.max(riskScore, 0), 100),
    };
  }

  // Gas price prediction with ML-inspired heuristics
  async predictOptimalGasTime(currentGasPrice: number): Promise<{
    recommendation: 'now' | 'wait_short' | 'wait_long';
    estimatedSavings: number;
    message: string;
    optimalTime?: string;
  }> {
    try {
      // In production: use historical gas data and ML model
      // For now: use simple heuristics based on time of day

      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay();

      // Weekend typically has lower gas
      const isWeekend = day === 0 || day === 6;

      // Off-peak hours (2 AM - 6 AM UTC is typically cheapest)
      const isOffPeak = hour >= 2 && hour <= 6;

      // Peak hours (afternoon US time = evening Europe)
      const isPeak = hour >= 14 && hour <= 20;

      if (isOffPeak || (isWeekend && !isPeak)) {
        return {
          recommendation: 'now',
          estimatedSavings: 0,
          message: '✅ Good time for transactions! Gas is relatively low right now.',
        };
      }

      if (isPeak && !isWeekend) {
        const hoursToWait = (26 - hour) % 24; // Calculate hours until 2 AM
        const estimatedSavings = currentGasPrice * 0.4; // Estimate 40% savings

        return {
          recommendation: 'wait_long',
          estimatedSavings,
          message: `⏰ Gas is nu ${currentGasPrice.toFixed(0)} gwei. Wacht ${hoursToWait}u voor ~40% besparing`,
          optimalTime: `Vanavond laat / vroege ochtend (2-6 uur)`,
        };
      }

      // Moderate times
      const hoursToWait = Math.min(4, (26 - hour) % 24);
      const estimatedSavings = currentGasPrice * 0.2; // Estimate 20% savings

      return {
        recommendation: 'wait_short',
        estimatedSavings,
        message: `💡 Overweeg ${hoursToWait}u te wachten voor ~20% lagere gas kosten`,
        optimalTime: 'Over een paar uur',
      };
    } catch (error) {
      logger.error('Gas prediction error:', error);
      return {
        recommendation: 'now',
        estimatedSavings: 0,
        message: 'Kon geen gas voorspelling maken',
      };
    }
  }

  // Conversational AI assistant (stub - feature disabled)
  async chat(message: string, context?: any): Promise<string> {
    try {
      // Add to conversation history
      this.conversationHistory.push({ role: 'user', content: message });

      // Common crypto questions (works offline)
      const commonQuestions: { [key: string]: string } = {
        'what is gas': 'Gas is the transaction fee on Ethereum. It\'s the price you pay to miners/validators to process your transaction. Measured in gwei (1 gwei = 0.000000001 ETH).',
        'what is slippage': 'Slippage is the difference between the expected price and the actual price of a swap. During high volatility, the price can change while your transaction is being executed.',
        'what is impermanent loss': 'Impermanent loss occurs in liquidity pools when the price of your tokens changes compared to when you added them. It\'s called "impermanent" because it\'s only permanent when you withdraw your tokens.',
        'why is my swap failing': 'Possible reasons: 1) Not enough ETH for gas, 2) Slippage set too low, 3) Token has insufficient liquidity, or 4) You need to approve the token first.',
        'what is a smart contract': 'A smart contract is code that automatically executes on the blockchain. They are the "apps" of crypto - like Uniswap for swaps or Aave for lending.',
        'how does defi work': 'DeFi (Decentralized Finance) are financial services without banks. You can borrow, lend, swap and earn through smart contracts on the blockchain.',
        'what is yield farming': 'Yield farming is earning rewards by staking your tokens in liquidity pools. You get tokens as rewards for providing liquidity.',
        'what is staking': 'Staking is locking up your tokens to secure the network. You get rewards as compensation for participating in consensus.',
        'what are nfts': 'NFTs (Non-Fungible Tokens) are unique digital items on the blockchain. They can represent art, music, games or other digital assets.',
        'how do i buy crypto': 'You can buy crypto on exchanges like Coinbase, Binance or Kraken. Always use a reputable exchange and store your crypto securely.',
        'what is a wallet': 'A crypto wallet is a digital wallet to store your cryptocurrency. It contains your private keys that give you access to your crypto.',
        'what is bitcoin': 'Bitcoin is the first and largest cryptocurrency. It\'s a digital currency that works without a central bank and is used as a store of value.',
        'what is ethereum': 'Ethereum is a blockchain platform where smart contracts run. It\'s the foundation for many DeFi apps, NFTs and other blockchain projects.',
        'what are altcoins': 'Altcoins are all cryptocurrencies except Bitcoin. Popular altcoins are Ethereum, Cardano, Solana and Polygon.',
      };

      // Check for common questions
      const lowerMessage = message.toLowerCase();
      for (const [question, answer] of Object.entries(commonQuestions)) {
        if (lowerMessage.includes(question)) {
          const response = answer;
          this.conversationHistory.push({ role: 'assistant', content: response });
          return response;
        }
      }

      // For any other question, return a helpful message
      const response = 'This feature is currently unavailable. Please use the AI Portfolio Advisor, Gas Optimizer, or Whisper features instead.';
      this.conversationHistory.push({ role: 'assistant', content: response });
      return response;
    } catch (error: any) {
      logger.error('Chat error:', error);
      return 'Sorry, something went wrong. Please try again.';
    }
  }

  clearConversation() {
    this.conversationHistory = [];
  }
}

export const aiService = new AIService();

