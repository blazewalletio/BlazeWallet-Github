'use client';

import { useState, useEffect } from 'react';
import { aiService } from '@/lib/ai-service';
import { motion } from 'framer-motion';
import { TrendingUp, Lightbulb, PieChart, AlertCircle, ArrowLeft } from 'lucide-react';

interface AIPortfolioAdvisorProps {
  onClose: () => void;
  tokens: any[];
  totalValue: number;
}

export default function AIPortfolioAdvisor({ onClose, tokens, totalValue }: AIPortfolioAdvisorProps) {
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const result = aiService.analyzePortfolio(tokens, totalValue);
    setAnalysis(result);
  }, [tokens, totalValue]);

  if (!analysis) return null;

  const getRiskColor = () => {
    if (analysis.riskScore < 40) return 'text-green-600';
    if (analysis.riskScore < 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskBg = () => {
    if (analysis.riskScore < 40) return 'bg-green-50 border-green-200';
    if (analysis.riskScore < 70) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getRiskLabel = () => {
    if (analysis.riskScore < 40) return 'Low risk';
    if (analysis.riskScore < 70) return 'Medium risk';
    return 'High risk';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-orange-500" />
            AI Portfolio Advisor
          </h2>
          <p className="text-gray-600">Personalized analysis and tips</p>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Portfolio Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-xl bg-white border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Total value</div>
              <div className="text-2xl font-bold text-gray-900">€{totalValue.toFixed(2)}</div>
            </div>
            <div className="p-6 rounded-xl bg-white border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Assets</div>
              <div className="text-2xl font-bold text-gray-900">{tokens.length} tokens</div>
            </div>
          </div>

          {/* Risk Score */}
          <div className={`p-6 rounded-xl border ${getRiskBg()}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-900 font-medium">Risk profile</span>
              <span className={`text-lg font-bold ${getRiskColor()}`}>
                {getRiskLabel()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  analysis.riskScore < 40 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                  analysis.riskScore < 70 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                  'bg-gradient-to-r from-orange-500 to-red-500'
                }`}
                style={{ width: `${analysis.riskScore}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Score: {analysis.riskScore}/100
            </p>
          </div>

          {/* Insights */}
          {analysis.insights.length > 0 && (
            <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 text-gray-900">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold">Insights</h3>
              </div>
              <div className="space-y-2">
                {analysis.insights.map((insight: string, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200"
                  >
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-900">{insight}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 text-gray-900">
                <Lightbulb className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold">Recommendations</h3>
              </div>
              <div className="space-y-2">
                {analysis.recommendations.map((rec: string, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 + 0.3 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200"
                  >
                    <Lightbulb className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-900">{rec}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Top Holdings */}
          <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900">Top holdings</h3>
            <div className="space-y-3">
              {tokens.slice(0, 5).map((token: any, i: number) => {
                const percentage = (parseFloat(token.usdValue) / totalValue) * 100;
                return (
                  <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{token.symbol}</span>
                      <span className="text-sm text-gray-600">
                        €{parseFloat(token.usdValue).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-12 text-right font-medium">
                        {percentage.toFixed(1)}%
                      </span>
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
              Always do your own research before making investment decisions.
            </p>
          </div>

          {/* Footer Button */}
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-medium transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </motion.div>
  );
}
