import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Force dynamic rendering (no static generation)
export const dynamic = 'force-dynamic';

// Lazy initialize OpenAI client
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Lazy load AI cache to avoid build-time Supabase initialization
async function getAICache() {
  const { aiCache } = await import('@/lib/ai-cache');
  return aiCache;
}

/**
 * 🤖 AI ASSISTANT API ROUTE
 * 
 * Hybrid Architecture:
 * 1. Check cache (localStorage + Supabase)
 * 2. Call GPT-4o-mini with function calling
 * 3. Cache response
 * 4. Return structured JSON
 * 
 * Rate limit: 50 queries/day per user
 */

const SYSTEM_PROMPT = `You are BlazeWallet AI Assistant, an intelligent crypto wallet assistant.

⚠️ IMPORTANT: Each query is INDEPENDENT. DO NOT assume context from previous messages.
Always ask for complete information if anything is unclear.

SUPPORTED CHAINS (18):
- EVM Chains: Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche, Fantom, Cronos, zkSync Era, Linea
- Solana (SOL)
- Bitcoin (BTC)
- Litecoin (LTC)
- Dogecoin (DOGE)
- Bitcoin Cash (BCH)

YOUR ROLE:
- Parse ONLY the current user command (ignore any implied context)
- Validate addresses for all supported chains
- Provide clear, helpful responses in English
- Ask for clarification when information is MISSING (don't guess!)
- Warn about risks (high fees, scams, low balance)
- Support natural language like "send all", "swap everything", "max"

ADDRESS FORMATS:
- EVM (11 chains): 0x... (42 characters, starts with 0x)
- Solana: Base58 (32-44 characters, alphanumeric)
- Bitcoin: bc1... or 1... or 3... (Native SegWit, Legacy, or SegWit)
- Litecoin: ltc1... or L... or M...
- Dogecoin: D...
- Bitcoin Cash: bitcoincash:... or 1... or 3...

RESPONSE FORMAT:
Always return valid JSON with this structure:
{
  "intent": "send|swap|receive|info|help|clarify",
  "params": {
    "amount": "50",
    "token": "USDC",
    "to": "0x...",
    "from": "ETH",
    "fromToken": "ETH",
    "toToken": "USDC",
    "chain": "ethereum"
  },
  "message": "Clear confirmation message for the user",
  "warnings": ["Any warnings or important notes"],
  "confidence": 0.95,
  "needsClarification": false,
  "clarificationQuestion": "Ask if info is missing",
  "suggestions": ["Helpful suggestions"]
}

EXAMPLES:

User: "Send 50 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0aAcC"
Response: {
  "intent": "send",
  "params": {
    "amount": "50",
    "token": "USDC",
    "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0aAcC"
  },
  "message": "Send 50 USDC to 0x742d...aAcC",
  "confidence": 0.99
}

User: "Send 0.5 BTC to bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
Response: {
  "intent": "send",
  "params": {
    "amount": "0.5",
    "token": "BTC",
    "to": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "chain": "bitcoin"
  },
  "message": "Send 0.5 BTC to bc1qxy...x0wlh",
  "confidence": 0.99
}

User: "Swap all my ETH to USDC"
Response: {
  "intent": "swap",
  "params": {
    "amount": "max",
    "fromToken": "ETH",
    "toToken": "USDC"
  },
  "message": "Swap all your ETH for USDC",
  "confidence": 0.95
}

User: "What's my balance?"
Response: {
  "intent": "info",
  "message": "Here's your portfolio overview",
  "confidence": 0.99
}

User: "Send USDC" (INCOMPLETE!)
Response: {
  "intent": "clarify",
  "needsClarification": true,
  "clarificationQuestion": "How much USDC would you like to send, and to which address?",
  "message": "I need more information to help you",
  "confidence": 0.8
}

User: "Can I swap from here?" (VAGUE!)
Response: {
  "intent": "clarify",
  "needsClarification": true,
  "clarificationQuestion": "Yes, you can swap tokens from here. Please specify which token you would like to swap and the amount.",
  "message": "Yes, you can swap tokens. Which token would you like to swap?",
  "confidence": 0.7
}

IMPORTANT RULES:
- DO NOT hallucinate transactions that weren't explicitly requested
- DO NOT assume amounts, tokens, or addresses from context
- ALWAYS ask for clarification if the command is incomplete or vague
- Support ALL variations: "send", "transfer", "pay", "give", "move"
- Handle typos gracefully (e.g., "sed" → "send")
- Understand "all", "max", "everything" as 100% of balance
- Validate address formats for each chain
- Be conversational and helpful
- Always include a user-friendly message
- Detect chain from address format automatically
- Warn if amount exceeds balance
- Warn about high gas fees on expensive chains
- If user asks general questions (not transactions), use "help" or "info" intent`;

interface AIRequest {
  query: string;
  context: {
    chain: string;
    balance: string;
    tokens: Array<{
      symbol: string;
      balance: string;
      usdValue: string;
    }>;
    address: string;
  };
  userId?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    // ✅ CORS headers (only allow same origin + Vercel previews)
    const origin = req.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL || 'https://blazewallet.io',
      'http://localhost:3000',
    ];
    
    // Allow Vercel preview deployments
    if (origin && (allowedOrigins.includes(origin) || origin.includes('.vercel.app'))) {
      // CORS is handled automatically by Next.js for same-origin
    }

    const body: AIRequest = await req.json();
    const { query, context, userId, conversationHistory } = body;

    // ✅ Input sanitization
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query must be a string' },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();
    
    if (!trimmedQuery) {
      return NextResponse.json(
        { error: 'Query cannot be empty' },
        { status: 400 }
      );
    }

    // Max length check (prevent abuse)
    if (trimmedQuery.length > 500) {
      return NextResponse.json(
        { error: 'Query is too long (max 500 characters)' },
        { status: 400 }
      );
    }

    // Basic XSS prevention (no HTML tags)
    if (/<[^>]*>/.test(trimmedQuery)) {
      return NextResponse.json(
        { error: 'Query contains invalid characters' },
        { status: 400 }
      );
    }

    console.log('🤖 [AI API] Processing query:', {
      query: trimmedQuery.substring(0, 50) + '...',
      chain: context.chain,
      userId: userId?.substring(0, 8)
    });

    // Get AI cache instance
    const aiCache = await getAICache();

    // Step 1: Check cache
    const cached = await aiCache.get(trimmedQuery, context);
    if (cached) {
      console.log('✅ [AI API] Cache hit - returning cached response');
      return NextResponse.json({
        ...cached,
        cached: true,
        source: 'cache'
      });
    }

    // Step 2: Check rate limit
    if (userId) {
      const rateLimit = await aiCache.checkRateLimit(userId, 50);
      
      if (!rateLimit.allowed) {
        console.warn('🚫 [AI API] Rate limit exceeded:', userId);
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: 'You have reached your daily limit of 50 AI queries. Please try again tomorrow or use your own API key in settings.',
            remaining: 0,
            total: 50
          },
          { status: 429 }
        );
      }

      console.log('✅ [AI API] Rate limit OK:', rateLimit);
    }

    // Step 3: Call OpenAI GPT-4o-mini
    console.log('📡 [AI API] Calling OpenAI...');
    
    // Build conversation messages with optional history
    const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      }
    ];

    // Add conversation history (max last 5 exchanges = 10 messages)
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10); // Keep last 10 messages
      messages.push(...recentHistory as any);
      console.log(`💬 [AI API] Including ${recentHistory.length} messages from history`);
    }

    // Add current query with context
    messages.push({
      role: 'user',
      content: `Context:
- Current chain: ${context.chain}
- Native balance: ${context.balance}
- Tokens: ${context.tokens.map(t => `${t.symbol} (${t.balance})`).join(', ')}
- User address: ${context.address}

User command: "${trimmedQuery}"

Parse this command and return structured JSON response.`
    });
    
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.1, // Low for consistent parsing
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    const response = JSON.parse(responseText);
    
    console.log('✅ [AI API] OpenAI response:', {
      intent: response.intent,
      confidence: response.confidence
    });

    // Step 4: Validate addresses if this is a send transaction
    if (response.intent === 'send' && response.params?.to) {
      console.log('🔍 [AI API] Validating recipient address:', response.params.to);
      
      try {
        const { addressValidator } = await import('@/lib/address-validator');
        const validation = addressValidator.validate(response.params.to);
        
        if (!validation.isValid) {
          console.warn('⚠️ [AI API] Invalid address detected:', validation.error);
          
          // Update response to clarify
          return NextResponse.json({
            intent: 'clarify',
            needsClarification: true,
            message: `The recipient address appears to be invalid: ${validation.error}. Please check the address and try again.`,
            clarificationQuestion: 'Please provide a valid wallet address.',
            confidence: 0.3,
            cached: false,
            source: 'validation-error'
          });
        }
        
        // Validate chain compatibility
        if (response.params.chain) {
          const expectedChainType = response.params.chain === 'ethereum' || response.params.chain === 'polygon' || response.params.chain === 'bsc' || response.params.chain === 'arbitrum' || response.params.chain === 'base' || response.params.chain === 'optimism' || response.params.chain === 'avalanche' || response.params.chain === 'fantom' || response.params.chain === 'cronos' || response.params.chain === 'zksync' || response.params.chain === 'linea' ? 'evm' : response.params.chain;
          
          if (validation.chainType !== expectedChainType) {
            const chainName = addressValidator.getChainName(validation.chainType!);
            console.warn(`⚠️ [AI API] Chain mismatch: address is for ${chainName}, but transaction is for ${response.params.chain}`);
            
            return NextResponse.json({
              intent: 'clarify',
              needsClarification: true,
              message: `⚠️ Chain mismatch detected! This address is for ${chainName}, but you're trying to send on ${response.params.chain}. Please switch to the correct network or use a valid ${response.params.chain} address.`,
              clarificationQuestion: `Would you like to switch to ${chainName} or use a different address?`,
              confidence: 0.5,
              warnings: [`This address belongs to ${chainName}, not ${response.params.chain}`],
              cached: false,
              source: 'validation-error'
            });
          }
        }
        
        console.log('✅ [AI API] Address validated successfully:', validation.chainType);
        
        // Add chain type to response if not present
        if (!response.params.chain && validation.chainType) {
          const chainMap: {[key: string]: string} = {
            'evm': context.chain, // Use current chain for EVM
            'solana': 'solana',
            'bitcoin': 'bitcoin',
            'litecoin': 'litecoin',
            'dogecoin': 'dogecoin',
            'bitcoin-cash': 'bitcoincash'
          };
          response.params.chain = chainMap[validation.chainType] || context.chain;
          console.log(`🔗 [AI API] Auto-detected chain: ${response.params.chain}`);
        }
        
        // Use normalized/checksum address
        if (validation.normalizedAddress) {
          response.params.to = validation.normalizedAddress;
        }
        
      } catch (error: any) {
        console.error('❌ [AI API] Address validation error:', error);
        // Continue without validation (non-blocking)
      }
    }

    // Step 5: Cache the response
    if (userId) {
      await aiCache.set(trimmedQuery, response, context, userId);
    }

    // Step 6: Return response
    return NextResponse.json({
      ...response,
      cached: false,
      source: 'openai',
      model: 'gpt-4o-mini'
    });

  } catch (error: any) {
    console.error('❌ [AI API] Error:', error);

    // Handle specific OpenAI errors
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'API key invalid', message: 'OpenAI API key is not configured correctly.' },
        { status: 500 }
      );
    }

    if (error.status === 429) {
      return NextResponse.json(
        { error: 'OpenAI rate limit', message: 'Too many requests to OpenAI. Please try again in a moment.' },
        { status: 429 }
      );
    }

    if (error.status === 500) {
      return NextResponse.json(
        { error: 'OpenAI error', message: 'OpenAI service is temporarily unavailable. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Something went wrong. Please try again.',
        details: error.message
      },
      { status: 500 }
    );
  }
}

