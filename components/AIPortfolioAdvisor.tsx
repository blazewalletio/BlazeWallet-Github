'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Lightbulb, PieChart, AlertCircle, ArrowLeft, Loader2, Activity, Shield, Target, TrendingDown, CheckCircle, AlertTriangle, RefreshCw, ShoppingCart, DollarSign, BarChart3 } from 'lucide-react';
import Image from 'next/image';
import { getCurrencyLogoSync } from '@/lib/currency-logo-service';
import { logger } from '@/lib/logger';

interface AIPortfolioAdvisorProps {
  onClose: () => void;
  tokens: any[];
  totalValue: number;
  totalValueChange24h?: number;
  chain: string;
  onBuyToken?: (symbol: string) => void;
  onSellToken?: (symbol: string) => void;
}

interface AnalysisData {
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

export default function AIPortfolioAdvisor({ 
  onClose, 
  tokens, 
  totalValue,
  totalValueChange24h = 0,
  chain,
  onBuyToken,
  onSellToken
}: AIPortfolioAdvisorProps) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only fetch analysis on mount, not on every prop change
  useEffect(() => {
    fetchAnalysis();
  }, []); // Empty dependency array = only run once on mount

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      logger.log('📊 [Portfolio Advisor] Fetching AI analysis...');
      logger.log('📊 [Portfolio Advisor] Raw tokens:', tokens);
      
      const response = await fetch('/api/ai-portfolio-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: tokens.map(t => {
            // Calculate USD value if not provided
            // Use priceUSD (from Token type) not price
            const tokenValue = t.balanceUSD ? parseFloat(t.balanceUSD) :
                              (t.priceUSD && t.balance ? parseFloat(t.balance) * t.priceUSD : 0);
            
            return {
              symbol: t.symbol,
              name: t.name || t.symbol,
              balance: t.balance || '0',
              usdValue: tokenValue.toString(),
              logoUrl: t.logo, // Dashboard uses 'logo' property
              price: t.priceUSD || 0,
              change24h: t.change24h || 0
            };
          }),
          totalValue,
          totalValueChange24h,
          chain
        })
      });

      const data = await response.json();

      if (data.success) {
        logger.log('✅ [Portfolio Advisor] Analysis received');
        setAnalysis(data.data);
      } else {
        logger.error('❌ [Portfolio Advisor] API error:', data.error);
        setError(data.error || 'Failed to analyze portfolio');
        // Use fallback if available
        if (data.fallback) {
          setAnalysis(data.fallback);
        }
      }
    } catch (err: any) {
      logger.error('❌ [Portfolio Advisor] Fetch error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = () => {
    if (!analysis) return 'text-gray-600';
    if (analysis.metrics.riskLevel === 'low') return 'text-green-600';
    if (analysis.metrics.riskLevel === 'medium') return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskBg = () => {
    if (!analysis) return 'bg-gray-50 border-gray-200';
    if (analysis.metrics.riskLevel === 'low') return 'bg-green-50 border-green-200';
    if (analysis.metrics.riskLevel === 'medium') return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getRiskLabel = () => {
    if (!analysis) return 'Calculating...';
    if (analysis.metrics.riskLevel === 'low') return 'Low risk';
    if (analysis.metrics.riskLevel === 'medium') return 'Medium risk';
    return 'High risk';
  };

  const getHealthColor = () => {
    if (!analysis) return 'text-gray-600';
    if (analysis.metrics.healthScore >= 75) return 'text-green-600';
    if (analysis.metrics.healthScore >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthLabel = () => {
    if (!analysis) return 'Calculating...';
    if (analysis.metrics.healthScore >= 75) return 'Excellent';
    if (analysis.metrics.healthScore >= 60) return 'Good';
    if (analysis.metrics.healthScore >= 40) return 'Fair';
    return 'Poor';
  };

  const getMarketIcon = () => {
    if (!analysis) return <BarChart3 className="w-5 h-5 text-blue-600" />;
    if (analysis.marketContext.condition === 'bullish') return <TrendingUp className="w-5 h-5 text-green-600" />;
    if (analysis.marketContext.condition === 'bearish') return <TrendingDown className="w-5 h-5 text-red-600" />;
    return <Activity className="w-5 h-5 text-gray-600" />;
  };

  const getInsightIcon = (type: string) => {
    if (type === 'positive') return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (type === 'warning') return <AlertTriangle className="w-5 h-5 text-orange-600" />;
    return <AlertCircle className="w-5 h-5 text-blue-600" />;
  };

  const getInsightBg = (type: string) => {
    if (type === 'positive') return 'bg-green-50 border-green-200';
    if (type === 'warning') return 'bg-orange-50 border-orange-200';
    return 'bg-blue-50 border-blue-200';
  };

  const getRecommendationIcon = (type: string) => {
    if (type === 'buy') return <ShoppingCart className="w-5 h-5 text-green-600" />;
    if (type === 'sell') return <DollarSign className="w-5 h-5 text-red-600" />;
    if (type === 'rebalance') return <Activity className="w-5 h-5 text-orange-600" />;
    return <Target className="w-5 h-5 text-blue-600" />;
  };

  return (
      <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 pb-24">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
          >
            ← Back to Dashboard
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <PieChart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">AI Portfolio Advisor</h2>
                <p className="text-sm text-gray-600">
                  Real-time analysis powered by GPT-4o-mini
                </p>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
              <p className="text-gray-600">Analyzing your portfolio with AI...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
            </div>
          )}

          {/* Error State */}
          {error && !analysis && !loading && (
            <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-900 font-semibold mb-2">Analysis Failed</p>
              <p className="text-sm text-red-700 mb-4">{error}</p>
              <button
                onClick={fetchAnalysis}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}

          {/* Content */}
          {analysis && !loading && (
            <div className="space-y-6">
              {/* Portfolio Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div
                  
                  
                  className="glass-card p-6"
                >
                  <div className="text-sm text-gray-600 mb-1">Total value</div>
                  <div className="text-2xl font-bold text-gray-900">${totalValue.toFixed(2)}</div>
                  {totalValueChange24h !== 0 && (
                    <div className={`text-sm mt-1 font-medium ${totalValueChange24h > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalValueChange24h > 0 ? '+' : ''}{totalValueChange24h.toFixed(2)}% (24h)
                    </div>
                  )}
                </div>
                <div
                  
                  
                  
                  className="glass-card p-6"
                >
                  <div className="text-sm text-gray-600 mb-1">Assets</div>
                  <div className="text-2xl font-bold text-gray-900">{tokens.length} token{tokens.length !== 1 ? 's' : ''}</div>
                  <div className="text-sm text-gray-600 mt-1">On {chain}</div>
                </div>
              </div>

              {/* Portfolio Health Score */}
              <div
                
                
                
                className="glass-card p-6 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-orange-600" />
                    <span className="text-sm text-gray-900 font-semibold">Portfolio Health Score</span>
                  </div>
                  <span className={`text-2xl font-bold ${getHealthColor()}`}>
                    {analysis.metrics.healthScore}/100
                  </span>
                </div>
                <div className="h-3 rounded-full bg-white/50 overflow-hidden mb-2">
                  <div
                    className="h-full transition-all duration-500 bg-gradient-to-r from-orange-500 to-yellow-500"
                    style={{ width: `${analysis.metrics.healthScore}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 font-medium">{getHealthLabel()}</span>
                  <span className="text-gray-600">Updated just now</span>
                </div>
              </div>

              {/* Risk & Diversification */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${getRiskBg()}`}>
                  <div className="text-sm text-gray-900 font-medium mb-1">Risk Level</div>
                  <div className={`text-xl font-bold ${getRiskColor()}`}>
                    {getRiskLabel()}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Volatility: {analysis.metrics.volatilityScore}/100
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="text-sm text-gray-900 font-medium mb-1">Diversification</div>
                  <div className="text-xl font-bold text-blue-600">
                    {analysis.metrics.diversificationScore}/100
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Top holding: {analysis.metrics.concentrationRisk}%
                  </div>
                </div>
              </div>

              {/* Market Context */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getMarketIcon()}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1 capitalize">
                      Market: {analysis.marketContext.condition}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{analysis.marketContext.sentiment}</p>
                    <p className="text-xs text-gray-600 flex items-start gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{analysis.marketContext.advice}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* AI Insights */}
              {analysis.insights.length > 0 && (
                <div className="glass-card p-6 space-y-3">
                  <div className="flex items-center gap-2 text-gray-900">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">AI Insights</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {analysis.insights.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {analysis.insights.map((insight, i) => (
                      <div
                        key={i}
                        
                        
                        
                        className={`flex items-start gap-3 p-4 rounded-lg border ${getInsightBg(insight.type)}`}
                      >
                        {getInsightIcon(insight.type)}
                        <p className="text-sm text-gray-900 flex-1">{insight.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Recommendations */}
              {analysis.recommendations.length > 0 && (
                <div className="glass-card p-6 space-y-3">
                  <div className="flex items-center gap-2 text-gray-900">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">Smart Recommendations</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {analysis.recommendations.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {analysis.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        
                        
                        
                        className="p-4 rounded-lg bg-orange-50 border border-orange-200"
                      >
                        <div className="flex items-start gap-3">
                          {getRecommendationIcon(rec.type)}
                          <div className="flex-1">
                            <p className="text-sm text-gray-900">{rec.message}</p>
                            {rec.action && (onBuyToken || onSellToken) && (
                              <button
                                onClick={() => {
                                  if (rec.action?.type === 'buy' && onBuyToken) {
                                    onBuyToken(rec.action.token);
                                  } else if (rec.action?.type === 'sell' && onSellToken) {
                                    onSellToken(rec.action.token);
                                  }
                                }}
                                className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  rec.action.type === 'buy'
                                    ? 'bg-green-500 hover:bg-green-600 text-white'
                                    : 'bg-red-500 hover:bg-red-600 text-white'
                                }`}
                              >
                                {rec.action.type === 'buy' ? '🛒 Buy' : '💰 Sell'} {rec.action.token}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Holdings with Logos */}
              <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900">Top Holdings</h3>
                <div className="space-y-3">
                  {tokens.slice(0, 5).map((token, i) => {
                    // Calculate USD value properly using correct Token properties
                    const tokenUsdValue = token.balanceUSD ? parseFloat(token.balanceUSD) :
                                         (token.priceUSD && token.balance ? parseFloat(token.balance) * token.priceUSD : 0);
                    const percentage = tokenUsdValue > 0 && totalValue > 0 ? (tokenUsdValue / totalValue) * 100 : 0;
                    
                    // Get correct logo - Dashboard uses 'logo' property
                    const logoUrl = token.logo || getCurrencyLogoSync(token.symbol);
                    
                    logger.log(`📊 Token ${token.symbol}:`, {
                      balance: token.balance,
                      priceUSD: token.priceUSD,
                      balanceUSD: token.balanceUSD,
                      calculated: tokenUsdValue,
                      logo: token.logo,
                      finalLogo: logoUrl
                    });
                    
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                        {/* Token Logo */}
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                          <Image
                            src={logoUrl}
                            alt={token.symbol}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                            unoptimized
                            onError={(e) => {
                              // Fallback to gradient with first letter
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              if (target.parentElement) {
                                target.parentElement.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center text-white font-bold flex-shrink-0';
                                target.parentElement.innerHTML = `<span class="text-lg">${token.symbol.charAt(0)}</span>`;
                              }
                            }}
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <span className="font-semibold text-gray-900">{token.symbol}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                {token.balance ? parseFloat(token.balance).toFixed(4) : '0'}
                              </span>
                            </div>
                            <span className="text-sm text-gray-900 font-semibold">
                              ${tokenUsdValue.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, percentage)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-12 text-right font-medium">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200">
                <p className="text-xs text-gray-700">
                  ⚠️ <strong>Disclaimer:</strong> This is not financial advice. 
                  AI analysis is provided for informational purposes only. 
                  Always do your own research before making investment decisions.
                </p>
              </div>

              {/* Footer Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={fetchAnalysis}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-lg bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Analysis
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-medium transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
