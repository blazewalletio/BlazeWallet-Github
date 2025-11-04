/**
 * 🔥 BLAZE WALLET - SMART SEND COMPARISON API
 * 
 * Compares current vs optimal gas prices for transaction scheduling
 * - Real-time gas prices
 * - 24h prediction using AI
 * - Savings calculation
 * - Worth-waiting decision
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { gasPriceService } from '@/lib/gas-price-service';
import { PriceService } from '@/lib/price-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ComparisonRequest {
  chain: string;
  amount: string;
  token?: string;
  transactionType?: 'transfer' | 'swap' | 'contract';
}

export async function POST(req: NextRequest) {
  try {
    console.log('\n========================================');
    console.log('⚡ [Smart Send] NEW COMPARISON REQUEST');
    console.log('========================================');

    const body: ComparisonRequest = await req.json();
    const { chain, amount, token, transactionType = 'transfer' } = body;

    console.log('📊 Request:', { chain, amount, token, transactionType });

    // Get current gas price
    console.log(`⛽ Fetching current gas for ${chain}...`);
    const currentGas = await gasPriceService.getGasPrice(chain);
    console.log('✅ Current gas:', currentGas.gasPrice, currentGas.source);

    // Get historical data for AI prediction
    const { gasHistoryService } = await import('@/lib/gas-history-service');
    const stats = await gasHistoryService.getStatistics(chain);

    // Get native currency price
    const priceService = new PriceService();
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
    const nativePrice = await priceService.getPrice(nativeCurrency) || 2000;

    console.log(`💰 ${nativeCurrency} price: $${nativePrice}`);

    // Calculate USD costs (chain-specific)
    const calculateCosts = (gasPrice: number) => {
      if (chain === 'solana') {
        const lamportsToSOL = (lamports: number) => lamports / 1e9;
        return {
          transfer: lamportsToSOL(gasPrice) * nativePrice,
          swap: lamportsToSOL(50000) * nativePrice,
          contract: lamportsToSOL(100000) * nativePrice,
        };
      } else if (chain === 'bitcoin' || chain === 'litecoin' || chain === 'dogecoin' || chain === 'bitcoincash') {
        const satPerVB = gasPrice;
        const transferSize = 140;
        const satToCrypto = (sats: number) => sats / 1e8;
        return {
          transfer: satToCrypto(satPerVB * transferSize) * nativePrice,
          swap: 0,
          contract: 0,
        };
      } else {
        const gweiToUsd = (gwei: number, gasUnits: number) => 
          (gwei / 1e9) * gasUnits * nativePrice;
        return {
          transfer: gweiToUsd(gasPrice, 21000),
          swap: gweiToUsd(gasPrice, 150000),
          contract: gweiToUsd(gasPrice, 300000),
        };
      }
    };

    const currentCosts = calculateCosts(currentGas.standard);
    const currentCost = currentCosts[transactionType];

    // Determine current gas level
    const avgGas = stats.avg24h;
    const currentLevel = 
      currentGas.standard < avgGas * 0.7 ? 'very_low' :
      currentGas.standard < avgGas * 0.9 ? 'low' :
      currentGas.standard < avgGas * 1.1 ? 'medium' :
      currentGas.standard < avgGas * 1.3 ? 'high' : 'very_high';

    console.log('📊 Current gas level:', currentLevel);

    // Use AI to predict optimal time and gas price
    console.log('🤖 Calling OpenAI for optimal time prediction...');

    const apiKey = process.env.GAS_OPTIMIZER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `You are a blockchain gas price analyst. Based on this data, predict the optimal time in the next 24 hours to execute a transaction.

**Current Gas Data:**
- Chain: ${chain}
- Current gas: ${currentGas.standard.toFixed(2)}
- Gas level: ${currentLevel}
- 24h average: ${avgGas.toFixed(2)}
- 24h min: ${stats.min24h.toFixed(2)}
- 24h max: ${stats.max24h.toFixed(2)}
- Current time: ${new Date().toLocaleString('en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC

**Historical Patterns:**
- Weekends: typically 20-30% lower
- Early morning (2-6 AM UTC): typically 30-40% lower
- Peak hours (14-18 UTC): typically 20-30% higher

**Task:**
Predict the optimal time in the next 24 hours to minimize gas costs.

Respond in JSON:
{
  "optimalTime": "<human readable time, e.g. 'Tonight at 3 AM' or 'Tomorrow morning at 6 AM'>",
  "hoursFromNow": <number of hours>,
  "predictedGasPrice": <predicted gas price>,
  "predictedLevel": "very_low" | "low" | "medium" | "high" | "very_high",
  "confidence": <0-100>,
  "reasoning": "<brief explanation>",
  "worthWaiting": <true if savings > $1, false otherwise>
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert blockchain gas price analyst. Provide accurate predictions based on historical data and patterns. Always respond in valid JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0].message.content;
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    const prediction = JSON.parse(aiResponse);
    console.log('✅ AI prediction:', prediction);

    // Calculate optimal costs
    const optimalCosts = calculateCosts(prediction.predictedGasPrice);
    const optimalCost = optimalCosts[transactionType];

    // Calculate savings
    const savingsUSD = currentCost - optimalCost;
    const savingsPercentage = (savingsUSD / currentCost) * 100;

    // Calculate timestamp for optimal time
    const optimalTimestamp = new Date();
    optimalTimestamp.setHours(optimalTimestamp.getHours() + prediction.hoursFromNow);

    const response = {
      success: true,
      comparison: {
        now: {
          gasPrice: currentGas.standard,
          gasCostUSD: currentCost,
          level: currentLevel,
        },
        optimal: {
          time: prediction.optimalTime,
          timestamp: optimalTimestamp.toISOString(),
          gasPrice: prediction.predictedGasPrice,
          gasCostUSD: optimalCost,
          level: prediction.predictedLevel,
        },
        savings: {
          usd: Math.max(0, savingsUSD),
          percentage: Math.max(0, savingsPercentage),
          worthWaiting: prediction.worthWaiting && savingsUSD > 0.5, // At least $0.50 savings
        },
        metadata: {
          confidence: prediction.confidence,
          reasoning: prediction.reasoning,
          chain,
          nativeCurrency,
          nativePrice,
        },
      },
    };

    console.log('✅ [Smart Send] Comparison complete');
    console.log('💰 Savings:', savingsUSD.toFixed(2), 'USD');
    console.log('========================================\n');

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [Smart Send] Error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to compare gas prices',
    }, { status: 500 });
  }
}

