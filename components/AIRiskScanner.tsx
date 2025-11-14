'use client';

import { useState } from 'react';
import { aiService } from '@/lib/ai-service';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Search, AlertTriangle, CheckCircle, XCircle, Loader2, ArrowLeft, Info, ExternalLink } from 'lucide-react';
import { logger } from '@/lib/logger';

interface AIRiskScannerProps {
  onClose: () => void;
  initialAddress?: string;
}

export default function AIRiskScanner({ onClose, initialAddress = '' }: AIRiskScannerProps) {
  const [address, setAddress] = useState(initialAddress);
  const [type, setType] = useState<'contract' | 'wallet'>('contract');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleScan = async () => {
    if (!address.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const analysis = await aiService.analyzeRisk(address, type);
      setResult(analysis);
    } catch (error) {
      setResult({
        risk: 'critical',
        warnings: ['Could not complete scan'],
        score: 0,
        details: 'Something went wrong during the scan.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getRiskBg = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-50 border-green-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      case 'high': return 'bg-orange-50 border-orange-200';
      case 'critical': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low': return <CheckCircle className="w-8 h-8" />;
      case 'medium': return <AlertTriangle className="w-8 h-8" />;
      case 'high': return <AlertTriangle className="w-8 h-8" />;
      case 'critical': return <XCircle className="w-8 h-8" />;
      default: return <Shield className="w-8 h-8" />;
    }
  };

  const getChainBadgeColor = (chainType: string) => {
    switch (chainType) {
      case 'evm': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'solana': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'bitcoin': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'litecoin': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'dogecoin': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'bitcoin-cash': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
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
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Scam Detector</h2>
                <p className="text-sm text-gray-600">
                  Scan addresses and contracts for security risks
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6">
            <div className="glass-card space-y-4">
              {/* Type selector */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setType('contract')}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                    type === 'contract'
                      ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Token / Smart contract
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setType('wallet')}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                    type === 'wallet'
                      ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Wallet address
                </motion.button>
              </div>

              {/* Input */}
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                  placeholder="Paste any crypto address (EVM, Solana, Bitcoin, etc.)"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm"
                  disabled={loading}
                />
                <button
                  onClick={handleScan}
                  disabled={loading || !address.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all shadow-lg shadow-red-500/20"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Results */}
              <AnimatePresence mode="wait">
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4 pt-4"
                  >
                    {/* Chain Detection Badge */}
                    {result.chainType && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Detected chain:</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getChainBadgeColor(result.chainType)}`}>
                          {result.chainName || result.chainType}
                        </span>
                      </div>
                    )}

                    {/* Risk Level */}
                    <div className={`text-center p-6 rounded-xl border ${getRiskBg(result.risk)}`}>
                      <div className={`flex justify-center mb-3 ${getRiskColor(result.risk)}`}>
                        {getRiskIcon(result.risk)}
                      </div>
                      <h3 className={`text-2xl font-bold uppercase ${getRiskColor(result.risk)}`}>
                        {result.risk === 'low' && 'Low risk'}
                        {result.risk === 'medium' && 'Medium risk'}
                        {result.risk === 'high' && 'High risk'}
                        {result.risk === 'critical' && 'Critical risk'}
                      </h3>
                      <p className="text-sm text-gray-700 mt-2">{result.details}</p>
                    </div>

                    {/* Score */}
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600 font-medium">Security score</span>
                        <span className="text-lg font-bold text-gray-900">{result.score}/100</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            result.score >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                            result.score >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                            result.score >= 30 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                            'bg-gradient-to-r from-red-500 to-red-700'
                          }`}
                          style={{ width: `${result.score}%` }}
                        />
                      </div>
                    </div>

                    {/* Warnings */}
                    {result.warnings.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-900">Security findings:</h4>
                        {result.warnings.map((warning: string, i: number) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200"
                          >
                            <span className="text-sm text-gray-700">{warning}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Powered by */}
                    <div className="flex items-center gap-2 justify-center pt-2">
                      <Info className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        Powered by GoPlus Security & Chainabuse
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Info */}
              {!result && !loading && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-sm text-gray-700">
                      💡 <strong>Tip:</strong> Always scan new contracts and addresses before interacting with them.
                      This tool checks for honeypots, scams, and red flags.
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>✅ Supported chains:</strong>
                    </p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>🔷 EVM: Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche, Fantom, Cronos, zkSync, Linea</li>
                      <li>🟣 Solana</li>
                      <li>🟠 Bitcoin, ⚪ Litecoin, 🟡 Dogecoin, 🟢 Bitcoin Cash</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-medium transition-colors"
              >
                Close
              </button>
              {result && (
                <button
                  onClick={() => {
                    setResult(null);
                    setAddress('');
                  }}
                  className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-medium transition-colors"
                >
                  New scan
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
