'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { MultiChainService } from '@/lib/multi-chain-service';

/**
 * 🧪 TEMPORARY TEST COMPONENT
 * 
 * Tests transaction history metadata for ALL chains
 * 
 * TO USE:
 * 1. Import in Dashboard.tsx: import TransactionHistoryTest from './TransactionHistoryTest';
 * 2. Add to render: <TransactionHistoryTest />
 * 3. Click "🧪 Test Transaction History" button
 * 4. When done testing, delete this file and remove import
 */

interface TestResult {
  chain: string;
  status: 'pending' | 'success' | 'error';
  tokenName?: string;
  tokenSymbol?: string;
  logoUrl?: string;
  txCount?: number;
  error?: string;
  details?: any[];
}

// Test addresses with known transaction history
const TEST_ADDRESSES = {
  // EVM chains
  ethereum: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // Vitalik
  polygon: '0x1111111254EEB25477B68fb85Ed929f73A960582', // 1inch Router
  arbitrum: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a', // Bridge
  base: '0x4200000000000000000000000000000000000006', // WETH
  bsc: '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3', // Binance Hot Wallet
  optimism: '0x4200000000000000000000000000000000000042', // OP Token
  avalanche: '0x9f8c163cBA728e99993ABe7495F06c0A3c8Ac8b9', // Bridge
  fantom: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83', // Fantom Foundation
  cronos: '0x6aB6d61428fde76768D7b45D8BFeec19c6eF91A8', // Cronos Bridge
  zksync: '0x0000000000000000000000000000000000008001', // System Contract
  linea: '0x508Ca82Df566dCD1B0DE8296e70a96332cD644ec', // Bridge
  
  // Solana
  solana: 'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM', // Pump.fun (SOL + SPL tokens!)
  
  // Bitcoin forks
  bitcoin: 'bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97', // Treasury
  litecoin: 'ltc1qum96uh7kjdx2akae6fefk4uwjh8zdmhv8lm2q5', // LTC Foundation
  dogecoin: 'DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L', // Foundation
  bitcoincash: 'qpm2qsznhks23z7629mms6s4cwef74vcwva499qr', // Popular address
};

// Expected metadata per chain
const EXPECTED_METADATA = {
  ethereum: { tokenName: 'Ethereum', tokenSymbol: 'ETH' },
  polygon: { tokenName: 'Polygon', tokenSymbol: 'MATIC' },
  arbitrum: { tokenName: 'Arbitrum', tokenSymbol: 'ETH' },
  base: { tokenName: 'Base', tokenSymbol: 'ETH' },
  bsc: { tokenName: 'BNB Chain', tokenSymbol: 'BNB' },
  optimism: { tokenName: 'Optimism', tokenSymbol: 'ETH' },
  avalanche: { tokenName: 'Avalanche', tokenSymbol: 'AVAX' },
  fantom: { tokenName: 'Fantom', tokenSymbol: 'FTM' },
  cronos: { tokenName: 'Cronos', tokenSymbol: 'CRO' },
  zksync: { tokenName: 'zkSync Era', tokenSymbol: 'ETH' },
  linea: { tokenName: 'Linea', tokenSymbol: 'ETH' },
  solana: { tokenName: 'Solana', tokenSymbol: 'SOL' },
  bitcoin: { tokenName: 'Bitcoin', tokenSymbol: 'BTC' },
  litecoin: { tokenName: 'Litecoin', tokenSymbol: 'LTC' },
  dogecoin: { tokenName: 'Dogecoin', tokenSymbol: 'DOGE' },
  bitcoincash: { tokenName: 'Bitcoin Cash', tokenSymbol: 'BCH' },
};

export default function TransactionHistoryTest() {
  const [isOpen, setIsOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [expandedChain, setExpandedChain] = useState<string | null>(null);

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    
    const chains = Object.keys(TEST_ADDRESSES) as (keyof typeof TEST_ADDRESSES)[];
    
    for (const chain of chains) {
      // Add pending result
      setResults(prev => [...prev, {
        chain,
        status: 'pending',
      }]);
      
      try {
        const address = TEST_ADDRESSES[chain];
        const service = MultiChainService.getInstance(chain);
        
        // Fetch transactions (limit to 3 for speed)
        const txs = await service.getTransactionHistory(address, 3);
        
        if (txs.length === 0) {
          // Update with error
          setResults(prev => prev.map(r => 
            r.chain === chain 
              ? { ...r, status: 'error', error: 'No transactions found', txCount: 0 }
              : r
          ));
          continue;
        }
        
        // Get first transaction for testing
        const firstTx = txs[0];
        const expected = EXPECTED_METADATA[chain];
        
        // Check metadata
        const hasCorrectName = firstTx.tokenName === expected.tokenName;
        const hasCorrectSymbol = firstTx.tokenSymbol === expected.tokenSymbol;
        const hasLogo = !!firstTx.logoUrl;
        
        // Determine status
        const allCorrect = hasCorrectName && hasCorrectSymbol && hasLogo;
        
        // Update result
        setResults(prev => prev.map(r => 
          r.chain === chain 
            ? {
                ...r,
                status: allCorrect ? 'success' : 'error',
                tokenName: firstTx.tokenName,
                tokenSymbol: firstTx.tokenSymbol,
                logoUrl: firstTx.logoUrl,
                txCount: txs.length,
                error: !allCorrect ? 'Metadata mismatch' : undefined,
                details: txs.map(tx => ({
                  hash: tx.hash.substring(0, 10) + '...',
                  tokenName: tx.tokenName,
                  tokenSymbol: tx.tokenSymbol,
                  hasLogo: !!tx.logoUrl,
                  type: tx.type,
                })),
              }
            : r
        ));
        
      } catch (error: any) {
        // Update with error
        setResults(prev => prev.map(r => 
          r.chain === chain 
            ? { ...r, status: 'error', error: error.message || 'Failed to fetch' }
            : r
        ));
      }
    }
    
    setTesting(false);
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-4 shadow-lg flex items-center gap-2"
        >
          <Beaker className="w-5 h-5" />
          <span className="font-semibold">Test TX History</span>
        </motion.button>
      )}

      {/* Test Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-96 max-h-[80vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-blue-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Beaker className="w-5 h-5 text-white" />
                  <h3 className="font-bold text-white">TX History Test</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {/* Status */}
              {results.length > 0 && (
                <div className="mt-3 flex items-center gap-3 text-sm text-white">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {successCount} passed
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-4 h-4" />
                    {errorCount} failed
                  </span>
                  {pendingCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {pendingCount} testing
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {results.length === 0 ? (
                <div className="text-center py-8">
                  <Beaker className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">
                    Test transaction history metadata<br />for all 18 chains
                  </p>
                  <button
                    onClick={runTests}
                    disabled={testing}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {testing ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Testing...
                      </span>
                    ) : (
                      'Start Test'
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((result) => (
                    <div key={result.chain} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Chain Header */}
                      <div
                        className={`p-3 flex items-center justify-between cursor-pointer ${
                          result.status === 'success'
                            ? 'bg-green-50'
                            : result.status === 'error'
                            ? 'bg-red-50'
                            : 'bg-gray-50'
                        }`}
                        onClick={() => setExpandedChain(expandedChain === result.chain ? null : result.chain)}
                      >
                        <div className="flex items-center gap-3">
                          {result.status === 'pending' && (
                            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                          )}
                          {result.status === 'success' && (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          )}
                          {result.status === 'error' && (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                          
                          <div>
                            <div className="font-semibold text-gray-900 capitalize">
                              {result.chain}
                            </div>
                            {result.status === 'success' && (
                              <div className="text-xs text-gray-600">
                                {result.txCount} transactions
                              </div>
                            )}
                            {result.status === 'error' && (
                              <div className="text-xs text-red-600">
                                {result.error}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {result.details && (
                          expandedChain === result.chain ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )
                        )}
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {expandedChain === result.chain && result.details && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-3 bg-gray-50 border-t border-gray-200 space-y-2">
                              {result.details.map((tx: any, idx: number) => (
                                <div key={idx} className="text-xs bg-white p-2 rounded border border-gray-200">
                                  <div className="font-mono text-gray-500 mb-1">
                                    {tx.hash}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <span className="text-gray-500">Name: </span>
                                      <span className={tx.tokenName ? 'text-green-600' : 'text-red-600'}>
                                        {tx.tokenName || '❌'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Symbol: </span>
                                      <span className={tx.tokenSymbol ? 'text-green-600' : 'text-red-600'}>
                                        {tx.tokenSymbol || '❌'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Logo: </span>
                                      <span className={tx.hasLogo ? 'text-green-600' : 'text-red-600'}>
                                        {tx.hasLogo ? '✅' : '❌'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Type: </span>
                                      <span className="text-gray-700">
                                        {tx.type || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {results.length > 0 && !testing && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={runTests}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Run Again
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

