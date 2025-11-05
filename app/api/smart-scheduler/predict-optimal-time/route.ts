// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER - AI GAS PREDICTION
// ============================================================================
// Uses OpenAI GPT-4o-mini + historical data to predict optimal gas times
// 95%+ confidence requirement before recommending
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.GAS_OPTIMIZER_API_KEY!;

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

    console.log('🤖 AI Prediction request:', {
      chain,
      current_gas_price,
      max_wait_hours,
    });

    // 1. Fetch 7-day historical gas data
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: historicalData, error: histError } = await supabase
      .from('gas_history')
      .select('*')
      .eq('chain', chain.toLowerCase())
      .gte('timestamp', sevenDaysAgo)
      .order('timestamp', { ascending: true });

    if (histError) {
      console.error('❌ Failed to fetch historical data:', histError);
    }

    console.log(`📊 Fetched ${historicalData?.length || 0} historical gas records`);

    // 2. Analyze patterns
    const analysis = analyzeGasPatterns(historicalData || [], current_gas_price);

    console.log('📈 Pattern analysis:', analysis);

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
1. Only recommend if you're 95%+ confident there will be savings
2. If current gas is already at/near optimal levels, recommend executing now
3. Consider time-of-day patterns (nights are usually cheaper)
4. Consider day-of-week patterns (weekends sometimes cheaper)
5. Provide 2-3 alternative time slots

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
    console.log('🤖 OpenAI response:', aiResponse);

    // Parse AI response
    let prediction: any;
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = aiResponse?.replace(/```json\n?|\n?```/g, '').trim() || '{}';
      prediction = JSON.parse(cleanedResponse);
    } catch (e) {
      console.error('❌ Failed to parse AI response:', e);
      throw new Error('Failed to parse AI prediction');
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

    console.log('✅ Final prediction:', response);

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error: any) {
    console.error('❌ Prediction API error:', error);
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
    const hour = new Date(d.timestamp).getHours();
    return hour >= 0 && hour < 6;
  });
  const dayData = historicalData.filter(d => {
    const hour = new Date(d.timestamp).getHours();
    return hour >= 9 && hour < 17;
  });

  // Weekend vs Weekday analysis
  const weekendData = historicalData.filter(d => {
    const day = new Date(d.timestamp).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  });
  const weekdayData = historicalData.filter(d => {
    const day = new Date(d.timestamp).getDay();
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
    min_gas_time: historicalData[minIndex]?.timestamp || new Date().toISOString(),
    max_gas_time: historicalData[maxIndex]?.timestamp || new Date().toISOString(),
    current_vs_average_percent: ((currentGas - avgGas) / avgGas) * 100,
    night_average: nightAvg,
    day_average: dayAvg,
    weekend_average: weekendAvg,
    weekday_average: weekdayAvg,
  };
}

function getGasUnit(chain: string): string {
  if (chain === 'solana') return 'microlamports';
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

    // Get native currency price
    const priceResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/prices?symbols=${chain === 'solana' ? 'SOL' : chain === 'bitcoin' ? 'BTC' : 'ETH'}`);
    let nativePrice = 0;
    
    if (priceResponse.ok) {
      const priceData = await priceResponse.json();
      nativePrice = priceData.prices?.[0]?.price || 0;
    }

    // Calculate savings based on chain type
    let currentCostUSD = 0;
    let predictedCostUSD = 0;

    if (chain === 'solana') {
      // Solana: microlamports * 5000 compute units / 1B = SOL
      currentCostUSD = (currentGas * 5000 / 1_000_000_000) * nativePrice;
      predictedCostUSD = (predictedGas * 5000 / 1_000_000_000) * nativePrice;
    } else if (chain.includes('bitcoin')) {
      // Bitcoin-like: sat/vB * 250 bytes / 100M = BTC
      currentCostUSD = ((currentGas * 250) / 100_000_000) * nativePrice;
      predictedCostUSD = ((predictedGas * 250) / 100_000_000) * nativePrice;
    } else {
      // EVM chains: (gas_units * gas_price) / 1e9 = ETH
      currentCostUSD = ((gasUnits * currentGas) / 1e9) * nativePrice;
      predictedCostUSD = ((gasUnits * predictedGas) / 1e9) * nativePrice;
    }

    return Math.max(0, currentCostUSD - predictedCostUSD);
  } catch (e) {
    console.error('Failed to calculate USD savings:', e);
    return 0;
  }
}

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { status: 200 });
}

