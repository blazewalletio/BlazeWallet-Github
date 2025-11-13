/**
 * 🔥 BLAZE WALLET - AI GAS OPTIMIZER API
 * 
 * OpenAI-powered gas optimization analysis
 * - Real-time gas price analysis
 * - Historical trend analysis
 * - Intelligent timing recommendations
 * - Multi-chain comparison
 * - MEV protection warnings
 * 
 * Cost: ~$0.001 per analysis (GPT-4o-mini)
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { gasPriceService } from '@/lib/gas-price-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface GasAnalysisRequest {
  chain: string;
  transactionType?: 'transfer' | 'swap' | 'contract' | 'nft';
  urgency?: 'low' | 'medium' | 'high';
  userId?: string;
}

interface GasAnalysisResponse {
  success: boolean;
  analysis?: {
    // Current state
    currentGas: {
      price: number;
      level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
      usdCost: {
        transfer: number;
        swap: number;
        contract: number;
      };
    };
    
    // Historical context
    historical: {
      avg24h: number;
      min24h: number;
      max24h: number;
      percentile: number; // 0-100, where user's gas price sits
    };
    
    // AI recommendation
    recommendation: {
      action: 'transact_now' | 'wait_short' | 'wait_long' | 'use_different_chain';
      confidence: number; // 0-100
      reasoning: string;
      estimatedSavings?: {
        gas: number;
        usd: number;
        percentage: number;
      };
      optimalTime?: string;
      alternativeChains?: {
        chain: string;
        savings: number;
      }[];
    };
    
    // Warnings
    warnings?: {
      type: 'mev_risk' | 'high_congestion' | 'unusual_activity';
      severity: 'low' | 'medium' | 'high';
      message: string;
    }[];
    
    // Tips
    tips: string[];
  };
  error?: string;
}

/**
 * POST /api/gas-optimizer
 * Analyze gas prices and provide AI-powered recommendations
 */
export async function POST(req: NextRequest) {
  try {
    logger.log('\n========================================');
    logger.log('⛽ [Gas Optimizer] NEW ANALYSIS REQUEST');
    logger.log('========================================');
    logger.log('📅 Timestamp:', new Date().toISOString());
    
    // Parse request
    const body: GasAnalysisRequest = await req.json();
    const { chain, transactionType = 'transfer', urgency = 'medium', userId } = body;
    
    logger.log('📊 Request:', { chain, transactionType, urgency, userId });
    
    // Validate chain
    if (!chain) {
      return NextResponse.json({
        success: false,
        error: 'Chain parameter is required',
      }, { status: 400 });
    }
    
    // Get real-time gas price
    logger.log(`⛽ Fetching real-time gas for ${chain}...`);
    const gasPrice = await gasPriceService.getGasPrice(chain);
    logger.log('✅ Gas price fetched:', gasPrice);
    
    // Get historical data from Supabase
    const { gasHistoryService } = await import('@/lib/gas-history-service');
    const stats = await gasHistoryService.getStatistics(chain);
    
    const historicalData = {
      avg24h: stats.avg24h,
      min24h: stats.min24h,
      max24h: stats.max24h,
    };
    
    // Get real-time native currency price
    const { PriceService } = await import('@/lib/price-service');
    const priceService = new PriceService();
    
    // Map chain to native currency symbol
    const nativeCurrencyMap: Record<string, string> = {
      'ethereum': 'ETH',
      'polygon': 'MATIC',
      'arbitrum': 'ETH',
      'optimism': 'ETH',
      'base': 'ETH',
      'avalanche': 'AVAX',
      'bsc': 'BNB',
      'fantom': 'FTM',
      'cronos': 'CRO',
      'zksync': 'ETH',
      'linea': 'ETH',
      'bitcoin': 'BTC',
      'litecoin': 'LTC',
      'dogecoin': 'DOGE',
      'bitcoincash': 'BCH',
      'solana': 'SOL',
    };
    
    const nativeCurrency = nativeCurrencyMap[chain.toLowerCase()] || 'ETH';
    const nativePrice = await priceService.getPrice(nativeCurrency) || 2000; // Fallback to 2000 if fetch fails
    
    logger.log(`💰 [Gas Optimizer] ${nativeCurrency} price: $${nativePrice}`);
    
    // Calculate USD costs (chain-specific logic!)
    let usdCosts: {
      transfer: number;
      swap: number;
      contract: number;
    };
    
    if (chain === 'solana') {
      // Solana: lamports → SOL → USD
      // gasPrice.standard is in lamports
      const lamportsToSOL = (lamports: number) => lamports / 1e9;
      
      usdCosts = {
        transfer: lamportsToSOL(gasPrice.standard) * nativePrice,
        swap: lamportsToSOL(50000) * nativePrice, // Typical DEX swap: ~50k lamports
        contract: lamportsToSOL(100000) * nativePrice, // Complex program: ~100k lamports
      };
      
      logger.log(`💰 Solana costs:`, usdCosts);
      
    } else if (chain === 'bitcoin' || chain === 'litecoin' || chain === 'dogecoin' || chain === 'bitcoincash') {
      // Bitcoin-like: sat/vB * transaction size → BTC → USD
      // gasPrice.standard is in sat/vB
      const satPerVB = gasPrice.standard;
      
      // Typical transaction sizes (in vBytes)
      const transferSize = 140; // P2WPKH (native SegWit)
      const swapSize = 0; // Bitcoin doesn't have "swaps" (no smart contracts)
      const contractSize = 0; // Bitcoin doesn't have smart contracts
      
      // Calculate: (sat/vB * vBytes) / 100,000,000 = BTC
      const satToCrypto = (sats: number) => sats / 1e8;
      
      usdCosts = {
        transfer: satToCrypto(satPerVB * transferSize) * nativePrice,
        swap: 0, // Not applicable for Bitcoin-like chains
        contract: 0, // Not applicable for Bitcoin-like chains
      };
      
      logger.log(`💰 ${chain} costs (sat/vB: ${satPerVB}):`, usdCosts);
      
    } else {
      // EVM chains: gwei * gas units → ETH → USD
      // gasPrice.standard is in gwei
      const gweiToUsd = (gwei: number, gasUnits: number) => 
        (gwei / 1e9) * gasUnits * nativePrice;
      
      usdCosts = {
        transfer: gweiToUsd(gasPrice.standard, 21000),
        swap: gweiToUsd(gasPrice.standard, 150000),
        contract: gweiToUsd(gasPrice.standard, 300000),
      };
      
      logger.log(`💰 EVM costs (gwei: ${gasPrice.standard}):`, usdCosts);
    }
    
    // Determine gas level
    const avgGas = historicalData.avg24h;
    const currentGas = gasPrice.standard;
    const gasLevel = 
      currentGas < avgGas * 0.7 ? 'very_low' :
      currentGas < avgGas * 0.9 ? 'low' :
      currentGas < avgGas * 1.1 ? 'medium' :
      currentGas < avgGas * 1.3 ? 'high' : 'very_high';
    
    logger.log('📊 Gas level:', gasLevel, `(current: ${currentGas}, avg: ${avgGas})`);
    
    // Build AI prompt
    const prompt = `You are an expert blockchain gas fee analyst. Analyze this gas price data and provide actionable recommendations.

**Current Gas Data:**
- Chain: ${chain}
- Current gas price: ${currentGas.toFixed(2)} gwei
- Gas level: ${gasLevel}
- 24h average: ${avgGas.toFixed(2)} gwei
- 24h range: ${historicalData.min24h.toFixed(2)} - ${historicalData.max24h.toFixed(2)} gwei

**Transaction Details:**
- Type: ${transactionType}
- Urgency: ${urgency}
- Estimated cost: $${usdCosts[transactionType as keyof typeof usdCosts]?.toFixed(2) || 'N/A'}

**Analysis Required:**
1. Should the user transact now, wait a short time (< 4 hours), wait longer (4-24 hours), or use a different chain?
2. What is your confidence level (0-100) in this recommendation?
3. Provide clear reasoning (2-3 sentences max)
4. If waiting is recommended, estimate potential savings in gas and USD
5. Suggest optimal timing if applicable (e.g., "in 3-4 hours", "tonight after 2 AM")
6. List any warnings (MEV risk, high congestion, etc) if applicable
7. Provide 3-4 actionable tips for gas optimization

**Context:**
- Time: ${new Date().toLocaleString('en-US', { timeZone: 'UTC', weekday: 'long', hour: '2-digit', minute: '2-digit' })} UTC
- Consider typical patterns: weekends and early mornings (2-6 AM UTC) are usually cheaper
- Consider urgency: high urgency may warrant higher gas even if suboptimal

Respond in JSON format:
{
  "action": "transact_now" | "wait_short" | "wait_long" | "use_different_chain",
  "confidence": <0-100>,
  "reasoning": "<clear explanation>",
  "estimatedSavings": {
    "gas": <gwei>,
    "usd": <dollars>,
    "percentage": <0-100>
  },
  "optimalTime": "<human readable time>",
  "warnings": [
    {"type": "mev_risk" | "high_congestion" | "unusual_activity", "severity": "low" | "medium" | "high", "message": "<description>"}
  ],
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}`;
    
    // Call OpenAI
    logger.log('🤖 Calling OpenAI GPT-4o-mini...');
    const apiKey = process.env.GAS_OPTIMIZER_API_KEY || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      logger.error('❌ No OpenAI API key configured');
      return NextResponse.json({
        success: false,
        error: 'AI service not configured',
      }, { status: 500 });
    }
    
    const openai = new OpenAI({ apiKey });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert blockchain gas fee analyst. Provide accurate, actionable advice to help users save on transaction costs. Always respond in valid JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Low temperature for consistent, factual responses
      max_tokens: 1000,
    });
    
    const aiResponse = completion.choices[0].message.content;
    logger.log('✅ OpenAI response received');
    logger.log('📄 Response:', aiResponse);
    
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }
    
    const recommendation = JSON.parse(aiResponse);
    
    // Build final response
    const response: GasAnalysisResponse = {
      success: true,
      analysis: {
        currentGas: {
          price: currentGas,
          level: gasLevel,
          usdCost: usdCosts,
        },
        historical: {
          avg24h: avgGas,
          min24h: historicalData.min24h,
          max24h: historicalData.max24h,
          percentile: ((currentGas - historicalData.min24h) / (historicalData.max24h - historicalData.min24h)) * 100,
        },
        recommendation: {
          action: recommendation.action,
          confidence: recommendation.confidence || 80,
          reasoning: recommendation.reasoning,
          estimatedSavings: recommendation.estimatedSavings,
          optimalTime: recommendation.optimalTime,
          alternativeChains: recommendation.alternativeChains,
        },
        warnings: recommendation.warnings || [],
        tips: recommendation.tips || [],
      },
    };
    
    logger.log('✅ [Gas Optimizer] Analysis complete');
    logger.log('========================================\n');
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    logger.error('❌ [Gas Optimizer] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to analyze gas prices',
    }, { status: 500 });
  }
}

/**
 * GET /api/gas-optimizer?chain=ethereum
 * Quick gas price check (no AI analysis)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chain = searchParams.get('chain') || 'ethereum';
    
    const gasPrice = await gasPriceService.getGasPrice(chain);
    
    return NextResponse.json({
      success: true,
      chain,
      gasPrice,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

