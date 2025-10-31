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
  // EVM chains - Use your own wallet address for real test!
  ethereum: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // Vitalik (many txs)
  polygon: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH on Polygon (active)
  arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC on Arbitrum (active)
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base (active)
  bsc: '0x55d398326f99059fF775485246999027B3197955', // USDT on BSC (very active)
  optimism: '0x4200000000000000000000000000000000000006', // WETH on Optimism (active)
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // USDC on Avalanche (active)
  fantom: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75', // USDC on Fantom (active)
  cronos: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23', // WCRO (active)
  zksync: '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91', // zkSync Bridge (active)
  linea: '0xA219439258ca9da29E9Cc4cE5596924745e12B93', // Linea Bridge (active)
  
  // Solana - Use real active address
  solana: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter (very active!)
  
  // Bitcoin forks - Use real active addresses
  bitcoin: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', // Active wallet
  litecoin: 'LQTpS3VaYTjCr4s9Y1t5zbeY5xJG3YaAJq', // Active LTC wallet
  dogecoin: 'DG2mPCnCPXzbwiqKpE1husv3FA9s5t1WMt', // Active DOGE wallet  
  bitcoincash: 'qqkv9wr69ry2p9l53lxp635va4h86wv435995w8p2h', // Active BCH wallet
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
    
    console.log('🧪 ============ STARTING TRANSACTION HISTORY TEST ============');
    
    const chains = Object.keys(TEST_ADDRESSES) as (keyof typeof TEST_ADDRESSES)[];
    
    for (const chain of chains) {
      console.log(`\n📋 Testing ${chain.toUpperCase()}...`);
      
      // Add pending result
      setResults(prev => [...prev, {
        chain,
        status: 'pending',
      }]);
      
      try {
        const address = TEST_ADDRESSES[chain];
        console.log(`   Address: ${address}`);
        
        const service = MultiChainService.getInstance(chain);
        
        // Fetch transactions (limit to 5 for better testing)
        console.log(`   Fetching transactions...`);
        const txs = await service.getTransactionHistory(address, 5);
        
        console.log(`   ✅ Fetched ${txs.length} transactions`);
        
        if (txs.length === 0) {
          console.warn(`   ⚠️ No transactions found for ${chain}`);
          // Update with error
          setResults(prev => prev.map(r => 
            r.chain === chain 
              ? { ...r, status: 'error', error: 'No transactions found', txCount: 0 }
              : r
          ));
          continue;
        }
        
        // Log all transactions for debugging
        txs.forEach((tx, idx) => {
          console.log(`   TX ${idx + 1}:`, {
            hash: tx.hash.substring(0, 10) + '...',
            tokenName: tx.tokenName || '❌ MISSING',
            tokenSymbol: tx.tokenSymbol || '❌ MISSING',
            logoUrl: tx.logoUrl ? '✅' : '❌ MISSING',
            type: tx.type,
            value: tx.value,
          });
        });
        
        // Get first transaction for testing
        const firstTx = txs[0];
        const expected = EXPECTED_METADATA[chain];
        
        // Check metadata
        const hasCorrectName = firstTx.tokenName === expected.tokenName;
        const hasCorrectSymbol = firstTx.tokenSymbol === expected.tokenSymbol;
        const hasLogo = !!firstTx.logoUrl;
        
        console.log(`   Validation:`, {
          tokenName: hasCorrectName ? '✅' : `❌ Expected "${expected.tokenName}", got "${firstTx.tokenName}"`,
          tokenSymbol: hasCorrectSymbol ? '✅' : `❌ Expected "${expected.tokenSymbol}", got "${firstTx.tokenSymbol}"`,
          logoUrl: hasLogo ? '✅' : '❌ Missing',
        });
        
        // Determine status
        const allCorrect = hasCorrectName && hasCorrectSymbol && hasLogo;
        
        if (allCorrect) {
          console.log(`   ✅ ${chain.toUpperCase()} PASSED!`);
        } else {
          console.error(`   ❌ ${chain.toUpperCase()} FAILED - Metadata mismatch`);
        }
        
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
                error: !allCorrect ? `Expected: ${expected.tokenName}/${expected.tokenSymbol}, Got: ${firstTx.tokenName}/${firstTx.tokenSymbol}` : undefined,
                details: txs.map(tx => ({
                  hash: tx.hash.substring(0, 10) + '...',
                  tokenName: tx.tokenName,
                  tokenSymbol: tx.tokenSymbol,
                  hasLogo: !!tx.logoUrl,
                  logoUrl: tx.logoUrl,
                  type: tx.type,
                  value: tx.value,
                  from: Array.isArray(tx.from) ? tx.from[0]?.substring(0, 10) + '...' : tx.from?.substring(0, 10) + '...',
                  to: Array.isArray(tx.to) ? tx.to[0]?.substring(0, 10) + '...' : tx.to?.substring(0, 10) + '...',
                })),
              }
            : r
        ));
        
      } catch (error: any) {
        console.error(`   ❌ ${chain.toUpperCase()} FAILED - Error:`, error.message);
        console.error('   Full error:', error);
        
        // Update with error
        setResults(prev => prev.map(r => 
          r.chain === chain 
            ? { ...r, status: 'error', error: error.message || 'Failed to fetch' }
            : r
        ));
      }
    }
    
    console.log('\n🎉 ============ TEST COMPLETE ============\n');
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
                              <div className="text-xs text-gray-600 mb-2">
                                📊 Found {result.txCount} transactions • Testing metadata...
                              </div>
                              {result.details.map((tx: any, idx: number) => (
                                <div key={idx} className="text-xs bg-white p-3 rounded border border-gray-200">
                                  <div className="font-mono text-gray-500 mb-2 flex items-center justify-between">
                                    <span>{tx.hash}</span>
                                    <span className="text-gray-400">{tx.type}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                      <span className="text-gray-500">Name: </span>
                                      <span className={tx.tokenName ? 'text-green-600 font-medium' : 'text-red-600'}>
                                        {tx.tokenName || '❌ Missing'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Symbol: </span>
                                      <span className={tx.tokenSymbol ? 'text-green-600 font-medium' : 'text-red-600'}>
                                        {tx.tokenSymbol || '❌ Missing'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Logo: </span>
                                      {tx.hasLogo ? (
                                        <span className="text-green-600 font-medium">✅ {tx.logoUrl}</span>
                                      ) : (
                                        <span className="text-red-600">❌ Missing</span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Value: </span>
                                      <span className="text-gray-700 font-mono">
                                        {typeof tx.value === 'string' ? parseFloat(tx.value).toFixed(6) : tx.value}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                                    <div>From: {tx.from}</div>
                                    <div>To: {tx.to}</div>
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

