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
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary-500" />
            Scam Detector
          </h2>
            <p className="text-gray-600">
              Scan addresses and contracts for security risks
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Stats Cards - Always visible */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-semibold">Supported</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">18+</div>
                <div className="text-sm text-gray-600 mt-1">
                  Blockchains
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Shield className="w-5 h-5" />
                  <span className="text-sm font-semibold">Protection</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">Real-time</div>
                <div className="text-sm text-gray-600 mt-1">
                  Scam detection
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm font-semibold">API Source</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">GoPlus</div>
                <div className="text-sm text-gray-600 mt-1">
                  Security provider
                </div>
              </motion.div>
            </div>

            {/* Scan Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold text-gray-900">Scan Address or Contract</h3>
              
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
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleScan}
                  disabled={loading || !address.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/20"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 text-white" />
                  )}
                </motion.button>
              </div>

              {/* Info - When no scan yet */}
              {!result && !loading && (
                <div className="pt-2">
                  <p className="text-sm text-gray-600">
                    💡 Paste any address or contract to check for scams, honeypots, and security risks.
                  </p>
                </div>
              )}
            </motion.div>

            {/* Results - Separate card */}
            <AnimatePresence mode="wait">
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="glass-card p-6 space-y-4"
                >
                  <h3 className="text-lg font-semibold text-gray-900">Scan Results</h3>
                  
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
                  <div className="flex items-center gap-2 justify-center pt-2 border-t border-gray-200">
                    <Info className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      Powered by GoPlus Security & Chainabuse
                    </span>
                  </div>

                  {/* New Scan Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setResult(null);
                      setAddress('');
                    }}
                    className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all shadow-lg shadow-red-500/30"
                  >
                    New Scan
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* How it Works - Always visible at bottom */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6 bg-gradient-to-br from-red-500/5 to-orange-500/5 border border-red-500/20"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">How Scam Detector Works</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                Our scam detector analyzes addresses and smart contracts across 18+ blockchains using GoPlus Security and Chainabuse APIs. 
                It checks for honeypots, malicious code, suspicious transactions, and known scam patterns.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Real-time scam database</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Smart contract analysis</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Multi-chain support</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Honeypot detection</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
