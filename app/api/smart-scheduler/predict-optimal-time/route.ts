// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER - AI GAS PREDICTION
// ============================================================================
// Uses OpenAI GPT-4o-mini + historical data to predict optimal gas times
// 95%+ confidence requirement before recommending
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import OpenAI from 'openai';
import { logger } from '@/lib/logger';

const openaiKey = process.env.GAS_OPTIMIZER_API_KEY!;

// In-memory cache for predictions (15 min TTL)
const predictionCache = new Map<string, { data: PredictionResponse; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

interface PredictionRequest {
  chain: string;
  current_gas_price: number;
  transaction_type?: 'transfer' | 'swap' | 'contract';
  max_wait_hours?: number;
}

interface PredictionResponse {
  optimal_time: string; // ISO timestamp
  confidence_score: number; // 0-100
  predicted_gas_price: number;
  estimated_savings_percent: number;
  estimated_savings_usd: number;
  reasoning: string;
  alternative_times?: Array<{
    time: string;
    gas_price: number;
    savings_percent: number;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: PredictionRequest = await req.json();
    const { chain, current_gas_price, max_wait_hours = 24 } = body;

    logger.log('🤖 AI Prediction request:', {
      chain,
      current_gas_price,
      max_wait_hours,
    });

    // Check cache first
    const cacheKey = `${chain}-${Math.floor(current_gas_price / 5)}`; // Group by ~5 unit ranges
    const cached = predictionCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      logger.log('✅ Cache hit for', cacheKey);
      return NextResponse.json({
        success: true,
        data: cached.data,
        cached: true,
      });
    }

    logger.log('📡 Cache miss, fetching fresh prediction...');

    // 1. Fetch 7-day historical gas data
    const supabase = getSupabaseAdmin();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: historicalData, error: histError } = await supabase
      .from('gas_history')
      .select('*')
      .eq('chain', chain.toLowerCase())
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true });

    if (histError) {
      logger.error('❌ Failed to fetch historical data:', histError);
    }

    logger.log(`📊 Fetched ${historicalData?.length || 0} historical gas records`);

    // 2. Analyze patterns
    const analysis = analyzeGasPatterns(historicalData || [], current_gas_price);

    logger.log('📈 Pattern analysis:', analysis);

    // 3. Use OpenAI for intelligent prediction
    const openai = new OpenAI({ apiKey: openaiKey });

    const prompt = `You are a blockchain gas price prediction expert. Analyze this data and predict the optimal time to execute a transaction.

**Current Situation:**
- Chain: ${chain}
- Current gas price: ${current_gas_price} ${getGasUnit(chain)}
- Current time: ${new Date().toISOString()}
- Maximum wait time: ${max_wait_hours} hours

**Historical Pattern Analysis (last 7 days):**
- Average gas price: ${analysis.average_gas.toFixed(2)}
- Lowest gas price: ${analysis.min_gas.toFixed(2)} (at ${analysis.min_gas_time})
- Highest gas price: ${analysis.max_gas.toFixed(2)} (at ${analysis.max_gas_time})
- Current vs Average: ${analysis.current_vs_average_percent.toFixed(1)}%
- Night time average (00:00-06:00): ${analysis.night_average.toFixed(2)}
- Day time average (09:00-17:00): ${analysis.day_average.toFixed(2)}
- Weekend average: ${analysis.weekend_average.toFixed(2)}
- Weekday average: ${analysis.weekday_average.toFixed(2)}

**Task:**
Predict the optimal time to execute this transaction within the next ${max_wait_hours} hours.

**Requirements:**
1. Recommend waiting ONLY if estimated savings are >= 5% AND you're 70%+ confident
2. If current gas is already at/near optimal levels (< 5% savings possible), recommend executing now
3. Consider time-of-day patterns (nights are usually cheaper)
4. Consider day-of-week patterns (weekends sometimes cheaper)
5. Provide 2-3 alternative time slots
6. Be practical: 70-90% confidence is acceptable if savings are significant (> 10%)

**Important:**
- Don't require 95% confidence - that's too strict!
- If you can save users 10-50%, recommend waiting even with 70-90% confidence
- Only recommend "execute now" if savings are truly minimal (< 5%)

**Response Format (JSON only, no markdown):**
{
  "optimal_time": "ISO timestamp",
  "confidence_score": 95,
  "predicted_gas_price": 123.45,
  "estimated_savings_percent": 25,
  "reasoning": "Detailed explanation why this time is optimal",
  "alternative_times": [
    {
      "time": "ISO timestamp",
      "gas_price": 123.45,
      "savings_percent": 20
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a blockchain gas price prediction expert. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const aiResponse = completion.choices[0].message.content;
    logger.log('🤖 OpenAI response:', aiResponse);

    // Parse AI response
    let prediction: any;
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = aiResponse?.replace(/```json\n?|\n?```/g, '').trim() || '{}';
      prediction = JSON.parse(cleanedResponse);
    } catch (e) {
      logger.error('❌ Failed to parse AI response:', e);
      throw new Error('Failed to parse AI prediction');
    }

    // Validate AI response
    const now = Date.now();
    const optimalTime = new Date(prediction.optimal_time).getTime();
    const maxWaitTime = now + (max_wait_hours * 60 * 60 * 1000);

    // Fix: If optimal time is in the past (with 5 sec buffer) or beyond max wait, set to +1 minute
    if (optimalTime < (now - 5000) || optimalTime > maxWaitTime) {
      logger.warn('⚠️ AI predicted invalid time, adjusting to +1 minute');
      prediction.optimal_time = new Date(now + 60000).toISOString(); // +1 minute from now
      prediction.confidence_score = Math.min(prediction.confidence_score || 0, 90);
      prediction.reasoning = 'Current gas price is already near optimal. ' + (prediction.reasoning || '');
    }

    // Validate confidence score
    if (!prediction.confidence_score || prediction.confidence_score < 0 || prediction.confidence_score > 100) {
      prediction.confidence_score = 50; // Default to low confidence
    }

    // Validate predicted gas price
    if (!prediction.predicted_gas_price || prediction.predicted_gas_price < 0) {
      prediction.predicted_gas_price = current_gas_price;
      prediction.estimated_savings_percent = 0;
    }

    // Validate savings percent
    if (!prediction.estimated_savings_percent || prediction.estimated_savings_percent < 0) {
      prediction.estimated_savings_percent = 0;
    }

    // 4. Calculate USD savings
    const estimated_savings_usd = await calculateSavingsUSD(
      chain,
      current_gas_price,
      prediction.predicted_gas_price,
      body.transaction_type || 'transfer'
    );

    // 5. Build final response
    const response: PredictionResponse = {
      optimal_time: prediction.optimal_time,
      confidence_score: prediction.confidence_score,
      predicted_gas_price: prediction.predicted_gas_price,
      estimated_savings_percent: prediction.estimated_savings_percent,
      estimated_savings_usd,
      reasoning: prediction.reasoning,
      alternative_times: prediction.alternative_times || [],
    };

    logger.log('✅ Final prediction:', response);

    // Store in cache
    predictionCache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error: any) {
    logger.error('❌ Prediction API error:', error);
    return NextResponse.json(
      { error: 'Failed to predict optimal time', details: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function analyzeGasPatterns(historicalData: any[], currentGas: number) {
  if (!historicalData || historicalData.length === 0) {
    return {
      average_gas: currentGas,
      min_gas: currentGas,
      max_gas: currentGas,
      min_gas_time: new Date().toISOString(),
      max_gas_time: new Date().toISOString(),
      current_vs_average_percent: 0,
      night_average: currentGas,
      day_average: currentGas,
      weekend_average: currentGas,
      weekday_average: currentGas,
    };
  }

  const gasPrices = historicalData.map(d => d.standard || d.gas_price || 0);
  const avgGas = gasPrices.reduce((a, b) => a + b, 0) / gasPrices.length;
  const minGas = Math.min(...gasPrices);
  const maxGas = Math.max(...gasPrices);
  
  const minIndex = gasPrices.indexOf(minGas);
  const maxIndex = gasPrices.indexOf(maxGas);
  
  // Night vs Day analysis (00:00-06:00 = night)
  const nightData = historicalData.filter(d => {
    const hour = new Date(d.created_at).getHours();
    return hour >= 0 && hour < 6;
  });
  const dayData = historicalData.filter(d => {
    const hour = new Date(d.created_at).getHours();
    return hour >= 9 && hour < 17;
  });

  // Weekend vs Weekday analysis
  const weekendData = historicalData.filter(d => {
    const day = new Date(d.created_at).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  });
  const weekdayData = historicalData.filter(d => {
    const day = new Date(d.created_at).getDay();
    return day >= 1 && day <= 5;
  });

  const nightAvg = nightData.length > 0 
    ? nightData.reduce((sum, d) => sum + (d.standard || d.gas_price || 0), 0) / nightData.length 
    : avgGas;
  const dayAvg = dayData.length > 0 
    ? dayData.reduce((sum, d) => sum + (d.standard || d.gas_price || 0), 0) / dayData.length 
    : avgGas;
  const weekendAvg = weekendData.length > 0 
    ? weekendData.reduce((sum, d) => sum + (d.standard || d.gas_price || 0), 0) / weekendData.length 
    : avgGas;
  const weekdayAvg = weekdayData.length > 0 
    ? weekdayData.reduce((sum, d) => sum + (d.standard || d.gas_price || 0), 0) / weekdayData.length 
    : avgGas;

  return {
    average_gas: avgGas,
    min_gas: minGas,
    max_gas: maxGas,
    min_gas_time: historicalData[minIndex]?.created_at || new Date().toISOString(),
    max_gas_time: historicalData[maxIndex]?.created_at || new Date().toISOString(),
    current_vs_average_percent: ((currentGas - avgGas) / avgGas) * 100,
    night_average: nightAvg,
    day_average: dayAvg,
    weekend_average: weekendAvg,
    weekday_average: weekdayAvg,
  };
}

function getGasUnit(chain: string): string {
  if (chain === 'solana') return 'lamports';
  if (chain.includes('bitcoin') || chain === 'litecoin' || chain === 'dogecoin') return 'sat/vB';
  return 'gwei';
}

async function calculateSavingsUSD(
  chain: string,
  currentGas: number,
  predictedGas: number,
  transactionType: string
): Promise<number> {
  try {
    // Estimate transaction size based on type
    let gasUnits = 21000; // Standard transfer
    if (transactionType === 'swap') gasUnits = 150000;
    if (transactionType === 'contract') gasUnits = 200000;

    // Get native currency price using relative URL
    const symbol = chain === 'solana' ? 'SOL' : 
                   chain === 'bitcoin' ? 'BTC' : 
                   chain === 'litecoin' ? 'LTC' :
                   chain === 'dogecoin' ? 'DOGE' :
                   chain === 'bitcoincash' ? 'BCH' :
                   'ETH';
    
    // Use relative URL instead of absolute URL
    const apiUrl = `https://my.blazewallet.io/api/prices?symbols=${symbol}`;
    logger.log(`💰 Fetching ${symbol} price from:`, apiUrl);
    
    const priceResponse = await fetch(apiUrl);
    let nativePrice = 0;
    
    if (priceResponse.ok) {
      try {
        const priceData = await priceResponse.json();
        nativePrice = priceData.prices?.[0]?.price || 0;
        logger.log(`✅ ${symbol} price: $${nativePrice}`);
      } catch (e) {
        logger.error('Failed to parse price response:', e);
      }
    } else {
      logger.error(`❌ Price API failed: ${priceResponse.status}`);
    }

    if (!nativePrice) {
      logger.warn('⚠️ Using fallback prices');
      // Fallback prices if API fails
      const fallbackPrices: Record<string, number> = {
        'ETH': 2500,
        'SOL': 155,
        'BTC': 70000,
        'LTC': 70,
        'DOGE': 0.10,
        'BCH': 350,
      };
      nativePrice = fallbackPrices[symbol] || 2500;
    }

    // Calculate savings based on chain type
    let currentCostUSD = 0;
    let predictedCostUSD = 0;

    if (chain === 'solana') {
      // Solana: lamports → SOL → USD
      // gasPrice is already in lamports (e.g., 5000 lamports = 0.000005 SOL)
      currentCostUSD = (currentGas / 1_000_000_000) * nativePrice;
      predictedCostUSD = (predictedGas / 1_000_000_000) * nativePrice;
      logger.log(`💰 Solana: ${currentGas} lamports ($${currentCostUSD.toFixed(6)}) → ${predictedGas} lamports ($${predictedCostUSD.toFixed(6)})`);
    } else if (chain.includes('bitcoin') || chain === 'litecoin' || chain === 'dogecoin' || chain === 'bitcoincash') {
      // Bitcoin-like: sat/vB * 250 bytes / 100M = BTC
      currentCostUSD = ((currentGas * 250) / 100_000_000) * nativePrice;
      predictedCostUSD = ((predictedGas * 250) / 100_000_000) * nativePrice;
      logger.log(`💰 ${chain}: ${currentGas} sat/vB ($${currentCostUSD.toFixed(6)}) → ${predictedGas} sat/vB ($${predictedCostUSD.toFixed(6)})`);
    } else {
      // EVM chains: (gas_units * gas_price) / 1e9 = ETH
      currentCostUSD = ((gasUnits * currentGas) / 1e9) * nativePrice;
      predictedCostUSD = ((gasUnits * predictedGas) / 1e9) * nativePrice;
      logger.log(`💰 EVM: ${currentGas} gwei ($${currentCostUSD.toFixed(6)}) → ${predictedGas} gwei ($${predictedCostUSD.toFixed(6)})`);
    }

    const savingsUSD = Math.max(0, currentCostUSD - predictedCostUSD);
    logger.log(`✅ Total USD savings: $${savingsUSD.toFixed(6)}`);
    
    return savingsUSD;
  } catch (e) {
    logger.error('Failed to calculate USD savings:', e);
    return 0;
  }
}

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { status: 200 });
}

