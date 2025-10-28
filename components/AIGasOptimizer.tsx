'use client';

import { useState, useEffect } from 'react';
import { aiService } from '@/lib/ai-service';
import { motion } from 'framer-motion';
import { Zap, Clock, TrendingDown, Loader2, ArrowLeft } from 'lucide-react';

interface AIGasOptimizerProps {
  onClose: () => void;
  currentGasPrice: number;
}

export default function AIGasOptimizer({ onClose, currentGasPrice }: AIGasOptimizerProps) {
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPrediction();
  }, []);

  const loadPrediction = async () => {
    setLoading(true);
    try {
      const result = await aiService.predictOptimalGasTime(currentGasPrice);
      setPrediction(result);
    } catch (error) {
      console.error('Gas prediction error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationColor = () => {
    if (!prediction) return 'text-gray-600';
    switch (prediction.recommendation) {
      case 'now': return 'text-green-600';
      case 'wait_short': return 'text-yellow-600';
      case 'wait_long': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getRecommendationBg = () => {
    if (!prediction) return 'bg-gray-50 border-gray-200';
    switch (prediction.recommendation) {
      case 'now': return 'bg-green-50 border-green-200';
      case 'wait_short': return 'bg-yellow-50 border-yellow-200';
      case 'wait_long': return 'bg-orange-50 border-orange-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getRecommendationIcon = () => {
    if (!prediction) return <Zap className="w-8 h-8" />;
    switch (prediction.recommendation) {
      case 'now': return <Zap className="w-8 h-8" />;
      case 'wait_short': return <Clock className="w-8 h-8" />;
      case 'wait_long': return <TrendingDown className="w-8 h-8" />;
      default: return <Zap className="w-8 h-8" />;
    }
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
            <Zap className="w-6 h-6 text-orange-500" />
            Gas Optimizer
          </h2>
          <p className="text-gray-600">Save on transaction costs</p>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 bg-white rounded-2xl border border-gray-200">
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            </div>
          ) : prediction ? (
            <>
              {/* Current Gas */}
              <div className="p-6 rounded-xl bg-white border border-gray-200">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Current gas price</p>
                  <p className="text-4xl font-bold text-gray-900">{currentGasPrice.toFixed(0)}</p>
                  <p className="text-sm text-gray-600 mt-1">gwei</p>
                </div>
              </div>

              {/* Recommendation */}
              <div className={`text-center p-6 rounded-xl border ${getRecommendationBg()}`}>
                <div className={`flex justify-center mb-4 ${getRecommendationColor()}`}>
                  {getRecommendationIcon()}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {prediction.recommendation === 'now' && 'Transact now!'}
                  {prediction.recommendation === 'wait_short' && 'Consider waiting'}
                  {prediction.recommendation === 'wait_long' && 'Wait for best price'}
                </h3>
                <p className="text-sm text-gray-700">{prediction.message}</p>
              </div>

              {/* Savings */}
              {prediction.estimatedSavings > 0 && (
                <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-gray-900 font-medium">Potential savings</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">
                        ~{prediction.estimatedSavings.toFixed(0)} gwei
                      </p>
                      <p className="text-xs text-gray-600">per transaction</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Optimal Time */}
              {prediction.optimalTime && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900">Optimal time</span>
                  </div>
                  <p className="text-lg text-blue-600 font-medium">{prediction.optimalTime}</p>
                </div>
              )}

              {/* Info */}
              <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-6">
                <h4 className="text-sm font-medium text-gray-900">💡 Gas saving tips:</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>• Early morning (2-6 AM) is usually cheapest</p>
                  <p>• Weekends often have lower gas prices</p>
                  <p>• Avoid transactions during US trading hours</p>
                  <p>• Use Layer 2 networks (Polygon, Arbitrum) for lower costs</p>
                </div>
              </div>

              {/* Historical Context */}
              <div className="p-6 rounded-xl bg-white border border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-4">Gas prices today</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Low</p>
                    <p className="text-lg font-bold text-green-600">
                      {Math.floor(currentGasPrice * 0.7)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Average</p>
                    <p className="text-lg font-bold text-orange-600">
                      {Math.floor(currentGasPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">High</p>
                    <p className="text-lg font-bold text-red-600">
                      {Math.floor(currentGasPrice * 1.5)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-600">Could not load gas prediction</p>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-medium transition-colors"
            >
              Close
            </button>
            <button
              onClick={loadPrediction}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-medium transition-all disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
