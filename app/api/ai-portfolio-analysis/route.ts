import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 🤖 AI PORTFOLIO ANALYSIS API
 * 
 * Uses OpenAI GPT-4o-mini to provide intelligent, personalized portfolio analysis
 * 
 * Features:
 * - Real AI-powered insights (not hardcoded rules)
 * - Personalized recommendations based on holdings
 * - Market context awareness
 * - Advanced risk & diversification analysis
 * - Actionable suggestions
 */

function getOpenAI() {
  const apiKey = process.env.PORTFOLIO_ADVISOR_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Portfolio Advisor API key not configured');
  }
  
  console.log('🤖 [Portfolio Advisor] Using API key:', apiKey.substring(0, 20) + '...');
  
  return new OpenAI({
    apiKey: apiKey,
  });
}

interface Token {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  logoUrl?: string;
  price?: number;
  change24h?: number;
}

interface AnalysisRequest {
  tokens: Token[];
  totalValue: number;
  chain: string;
  totalValueChange24h?: number;
}

interface AnalysisResponse {
  insights: {
    type: 'positive' | 'warning' | 'info';
    message: string;
    icon: string;
  }[];
  recommendations: {
    type: 'buy' | 'sell' | 'hold' | 'rebalance';
    message: string;
    action?: {
      type: 'buy' | 'sell';
      token: string;
      percentage?: number;
    };
  }[];
  metrics: {
    healthScore: number;
    diversificationScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    volatilityScore: number;
    concentrationRisk: number;
  };
  marketContext: {
    condition: 'bullish' | 'bearish' | 'neutral';
    sentiment: string;
    advice: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    console.log('🤖 [Portfolio Advisor] Receiving analysis request...');
    
    const body: AnalysisRequest = await req.json();
    const { tokens, totalValue, chain, totalValueChange24h } = body;
    
    console.log('📊 [Portfolio Advisor] Analyzing portfolio:', {
      tokens: tokens.length,
      totalValue: `$${totalValue.toFixed(2)}`,
      chain
    });
    
    // Calculate portfolio metrics
    const metrics = calculatePortfolioMetrics(tokens, totalValue);
    
    // Build AI prompt
    const prompt = buildAnalysisPrompt(tokens, totalValue, chain, totalValueChange24h || 0, metrics);
    
    console.log('🧠 [Portfolio Advisor] Sending to OpenAI GPT-4o-mini...');
    
    // Call OpenAI
    const openai = getOpenAI();
    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert cryptocurrency portfolio advisor. Provide clear, actionable, and personalized advice based on the user's specific holdings. 
          
          Be concise but insightful. Focus on:
          1. Real risks and opportunities in their specific portfolio
          2. Actionable recommendations (specific buy/sell/hold advice)
          3. Market timing and context
          4. Diversification and risk management
          5. Educational insights (explain WHY, not just WHAT)
          
          Respond in JSON format with insights, recommendations, and market context.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500,
    });
    
    const duration = Date.now() - startTime;
    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');
    
    console.log(`✅ [Portfolio Advisor] Analysis complete in ${duration}ms`);
    
    // Format response
    const response: AnalysisResponse = {
      insights: formatInsights(aiResponse.insights || []),
      recommendations: formatRecommendations(aiResponse.recommendations || []),
      metrics: metrics,
      marketContext: aiResponse.marketContext || {
        condition: 'neutral',
        sentiment: 'Mixed market signals',
        advice: 'Monitor your positions and stay informed'
      }
    };
    
    return NextResponse.json({
      success: true,
      data: response
    });
    
  } catch (error: any) {
    console.error('❌ [Portfolio Advisor] Analysis error:', {
      message: error.message,
      status: error.status,
      type: error.type
    });
    
    // Return fallback analysis on error
    return NextResponse.json({
      success: false,
      error: error.message,
      fallback: getFallbackAnalysis(await req.json())
    }, { status: 500 });
  }
}

/**
 * Calculate portfolio metrics
 */
function calculatePortfolioMetrics(tokens: Token[], totalValue: number) {
  if (tokens.length === 0) {
    return {
      healthScore: 0,
      diversificationScore: 0,
      riskLevel: 'low' as const,
      volatilityScore: 0,
      concentrationRisk: 0
    };
  }
  
  // Calculate diversification
  const tokenPercentages = tokens.map(t => (parseFloat(t.usdValue) / totalValue) * 100);
  const largestHolding = Math.max(...tokenPercentages);
  const top3Holdings = tokenPercentages.sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  
  // Diversification score (0-100)
  let diversificationScore = 100;
  if (tokens.length === 1) diversificationScore = 20;
  else if (tokens.length === 2) diversificationScore = 40;
  else if (tokens.length === 3) diversificationScore = 60;
  else if (tokens.length === 4) diversificationScore = 75;
  else diversificationScore = 90;
  
  // Concentration risk penalty
  if (largestHolding > 70) diversificationScore -= 30;
  else if (largestHolding > 50) diversificationScore -= 20;
  else if (largestHolding > 40) diversificationScore -= 10;
  
  diversificationScore = Math.max(0, Math.min(100, diversificationScore));
  
  // Volatility score (based on 24h changes)
  const changes = tokens.filter(t => t.change24h !== undefined).map(t => Math.abs(t.change24h || 0));
  const avgVolatility = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 5;
  const volatilityScore = Math.min(100, avgVolatility * 2);
  
  // Risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  const riskScore = (100 - diversificationScore) * 0.4 + volatilityScore * 0.6;
  if (riskScore < 30) riskLevel = 'low';
  else if (riskScore > 60) riskLevel = 'high';
  
  // Health score (0-100)
  const healthScore = Math.round(
    diversificationScore * 0.4 +
    (100 - volatilityScore) * 0.3 +
    (largestHolding < 50 ? 30 : 15)
  );
  
  return {
    healthScore: Math.max(0, Math.min(100, healthScore)),
    diversificationScore: Math.round(diversificationScore),
    riskLevel,
    volatilityScore: Math.round(volatilityScore),
    concentrationRisk: Math.round(largestHolding)
  };
}

/**
 * Build AI analysis prompt
 */
function buildAnalysisPrompt(tokens: Token[], totalValue: number, chain: string, change24h: number, metrics: any): string {
  const tokenList = tokens.map(t => {
    const percentage = (parseFloat(t.usdValue) / totalValue) * 100;
    return `- ${t.symbol} (${t.name}): $${parseFloat(t.usdValue).toFixed(2)} (${percentage.toFixed(1)}%)${t.change24h !== undefined ? ` [24h: ${t.change24h > 0 ? '+' : ''}${t.change24h.toFixed(2)}%]` : ''}`;
  }).join('\n');
  
  return `Analyze this crypto portfolio and provide personalized insights:

**Portfolio Overview:**
- Total Value: $${totalValue.toFixed(2)}
- 24h Change: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%
- Number of Assets: ${tokens.length}
- Primary Chain: ${chain}

**Holdings:**
${tokenList}

**Calculated Metrics:**
- Diversification Score: ${metrics.diversificationScore}/100
- Risk Level: ${metrics.riskLevel}
- Volatility Score: ${metrics.volatilityScore}/100
- Largest Holding: ${metrics.concentrationRisk}%

**Provide:**
1. **insights** (array): 3-5 specific insights about THIS portfolio (not generic). Focus on real risks/opportunities.
2. **recommendations** (array): 2-4 actionable recommendations. Be specific (e.g., "Buy more ETH" not "diversify more").
3. **marketContext**: Current market condition (bullish/bearish/neutral), sentiment summary, and timing advice.

Respond in JSON format:
{
  "insights": ["insight 1", "insight 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "marketContext": {
    "condition": "bullish|bearish|neutral",
    "sentiment": "brief market sentiment",
    "advice": "timing advice"
  }
}`;
}

/**
 * Format insights with types and icons
 */
function formatInsights(insights: string[]) {
  return insights.map((insight: string) => {
    // Determine type based on content
    let type: 'positive' | 'warning' | 'info' = 'info';
    let icon = '💡';
    
    if (insight.toLowerCase().includes('good') || insight.toLowerCase().includes('well') || insight.toLowerCase().includes('strong')) {
      type = 'positive';
      icon = '✅';
    } else if (insight.toLowerCase().includes('risk') || insight.toLowerCase().includes('warning') || insight.toLowerCase().includes('high') || insight.toLowerCase().includes('volatile')) {
      type = 'warning';
      icon = '⚠️';
    }
    
    return { type, message: insight, icon };
  });
}

/**
 * Format recommendations with action types
 */
function formatRecommendations(recommendations: string[]) {
  return recommendations.map((rec: string) => {
    // Determine action type based on content
    let type: 'buy' | 'sell' | 'hold' | 'rebalance' = 'hold';
    
    if (rec.toLowerCase().includes('buy') || rec.toLowerCase().includes('add') || rec.toLowerCase().includes('increase')) {
      type = 'buy';
    } else if (rec.toLowerCase().includes('sell') || rec.toLowerCase().includes('reduce') || rec.toLowerCase().includes('profit')) {
      type = 'sell';
    } else if (rec.toLowerCase().includes('rebalance') || rec.toLowerCase().includes('diversify')) {
      type = 'rebalance';
    }
    
    return { type, message: rec };
  });
}

/**
 * Fallback analysis if OpenAI fails
 */
function getFallbackAnalysis(request: AnalysisRequest): AnalysisResponse {
  const metrics = calculatePortfolioMetrics(request.tokens, request.totalValue);
  
  return {
    insights: [
      {
        type: 'info',
        message: `Your portfolio contains ${request.tokens.length} assets worth $${request.totalValue.toFixed(2)}`,
        icon: '📊'
      }
    ],
    recommendations: [
      {
        type: 'hold',
        message: 'Unable to generate AI recommendations. Please try again later.'
      }
    ],
    metrics,
    marketContext: {
      condition: 'neutral',
      sentiment: 'Analysis temporarily unavailable',
      advice: 'Monitor your positions and stay informed about market conditions'
    }
  };
}

