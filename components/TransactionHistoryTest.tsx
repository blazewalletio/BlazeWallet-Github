'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Plus, Copy } from 'lucide-react';
import { MultiChainService } from '@/lib/multi-chain-service';
import { transactionCache } from '@/lib/transaction-cache';
import { CHAINS } from '@/lib/chains';
import { useWalletStore } from '@/lib/wallet-store';
import { getCurrencyLogoSync } from '@/lib/currency-logo-service';

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

// Expected metadata per chain (based on nativeCurrency.name from chains.ts)
const EXPECTED_METADATA = {
  ethereum: { tokenName: 'Ethereum', tokenSymbol: 'ETH' },
  polygon: { tokenName: 'Polygon', tokenSymbol: 'MATIC' },
  arbitrum: { tokenName: 'Ethereum', tokenSymbol: 'ETH' }, // Uses ETH
  base: { tokenName: 'Ethereum', tokenSymbol: 'ETH' }, // Uses ETH
  bsc: { tokenName: 'BNB', tokenSymbol: 'BNB' },
  optimism: { tokenName: 'Ethereum', tokenSymbol: 'ETH' }, // Uses ETH
  avalanche: { tokenName: 'Avalanche', tokenSymbol: 'AVAX' },
  fantom: { tokenName: 'Fantom', tokenSymbol: 'FTM' },
  cronos: { tokenName: 'Cronos', tokenSymbol: 'CRO' },
  zksync: { tokenName: 'Ethereum', tokenSymbol: 'ETH' }, // Uses ETH
  linea: { tokenName: 'Ethereum', tokenSymbol: 'ETH' }, // Uses ETH
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
  const [addingMockData, setAddingMockData] = useState(false);
  const [detailedLog, setDetailedLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  
  // Get real wallet addresses
  const { address, solanaAddress, bitcoinAddress, litecoinAddress, dogecoinAddress, bitcoincashAddress } = useWalletStore();

  /**
   * 🎭 Add mock transactions for ALL chains
   * - Creates realistic test transactions with REAL metadata fetched from APIs
   * - Temporarily stores in transaction cache
   * - Visible in History tab
   * - Auto-cleans when cache expires or component is removed
   */
  const addMockTransactions = async () => {
    setAddingMockData(true);
    setShowLog(true);
    const log: string[] = [];
    
    log.push('🎭 ============ ADDING MOCK TRANSACTIONS ============');
    log.push(`📅 Timestamp: ${new Date().toISOString()}`);
    log.push(`🔗 Total Chains: ${Object.keys(CHAINS).length}`);
    log.push('');
    
    console.log(log[0]);
    
    const chains = Object.keys(CHAINS);
    let successCount = 0;
    const mockData: any = {};
    
    for (const chainKey of chains) {
      try {
        log.push(`\n${'='.repeat(60)}`);
        log.push(`🔗 CHAIN: ${chainKey.toUpperCase()}`);
        log.push(`${'='.repeat(60)}`);
        console.log(`\n🎭 Creating mock transactions for ${chainKey.toUpperCase()}...`);
        
        const chain = CHAINS[chainKey];
        const service = MultiChainService.getInstance(chainKey);
        
        // Get REAL wallet address for this chain
        let walletAddress = '';
        if (chainKey === 'solana') {
          walletAddress = solanaAddress || '';
        } else if (chainKey === 'bitcoin') {
          walletAddress = bitcoinAddress || '';
        } else if (chainKey === 'litecoin') {
          walletAddress = litecoinAddress || '';
        } else if (chainKey === 'dogecoin') {
          walletAddress = dogecoinAddress || '';
        } else if (chainKey === 'bitcoincash') {
          walletAddress = bitcoincashAddress || '';
        } else {
          // All EVM chains use the same address
          walletAddress = address || '';
        }
        
        if (!walletAddress) {
          log.push(`⚠️ No wallet address found for ${chainKey}, skipping...`);
          continue;
        }
        
        log.push(`✓ Chain Name: ${chain.name}`);
        log.push(`✓ Native Currency: ${chain.nativeCurrency.name} (${chain.nativeCurrency.symbol})`);
        log.push(`✓ Logo: ${chain.logoUrl}`);
        log.push(`✓ Wallet Address: ${walletAddress.substring(0, 10)}...${walletAddress.substring(walletAddress.length - 8)}`);
        
        // Create mock transactions with REAL metadata
        const mockTxs = [];
        
        // 1. Native currency transaction (use REAL wallet address)
        const isReceived = Math.random() > 0.5;
        const nativeTx = {
          hash: `0xMOCK${Date.now()}${Math.random().toString(36).substring(7)}`,
          from: isReceived ? '0xSender' + Math.random().toString(36).substring(7) : walletAddress,
          to: isReceived ? walletAddress : '0xRecipient' + Math.random().toString(36).substring(7),
          value: (Math.random() * 10).toFixed(6),
          timestamp: Date.now(),
          isError: false,
          tokenName: chain.nativeCurrency.name,
          tokenSymbol: chain.nativeCurrency.symbol,
          logoUrl: getCurrencyLogoSync(chain.nativeCurrency.symbol), // ✅ Dynamic currency logo
          type: isReceived ? 'Received' : 'Sent',
          blockNumber: Math.floor(Math.random() * 1000000),
        };
        mockTxs.push(nativeTx);
        log.push(`\n✅ Native Transaction Created:`);
        log.push(`   - Token: ${nativeTx.tokenName} (${nativeTx.tokenSymbol})`);
        log.push(`   - Amount: ${nativeTx.value}`);
        log.push(`   - Type: ${nativeTx.type}`);
        log.push(`   - Logo: ${nativeTx.logoUrl}`);
        log.push(`   - Hash: ${nativeTx.hash.substring(0, 20)}...`);
        console.log(`   ✅ Added native ${chain.nativeCurrency.symbol} transaction`);
        
        // 2. Token transaction (for EVM and Solana only)
        if (chainKey === 'solana') {
          // Add SPL token transaction (e.g., USDC)
          const isTokenReceived = Math.random() > 0.5;
          const splTx = {
            hash: `SOL_MOCK_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            from: isTokenReceived ? Math.random().toString(36).substring(2, 42) : walletAddress,
            to: isTokenReceived ? walletAddress : Math.random().toString(36).substring(2, 42),
            value: (Math.random() * 1000).toFixed(2),
            timestamp: Date.now() - 3600000, // 1 hour ago
            isError: false,
            tokenName: 'USD Coin',
            tokenSymbol: 'USDC',
            logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            type: 'Token Transfer',
            blockNumber: Math.floor(Math.random() * 1000000),
          };
          mockTxs.push(splTx);
          log.push(`\n✅ SPL Token Transaction Created:`);
          log.push(`   - Token: ${splTx.tokenName} (${splTx.tokenSymbol})`);
          log.push(`   - Amount: ${splTx.value}`);
          log.push(`   - Type: ${splTx.type}`);
          log.push(`   - Logo: ${splTx.logoUrl}`);
          log.push(`   - Mint: ${splTx.mint}`);
          console.log(`   ✅ Added SPL token (USDC) transaction`);
        } else if (!['bitcoin', 'litecoin', 'dogecoin', 'bitcoincash'].includes(chainKey)) {
          // Add ERC20 token transaction (e.g., USDT)
          const isTokenReceived = Math.random() > 0.5;
          const erc20Tx = {
            hash: `0xMOCK_TOKEN_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            from: isTokenReceived ? '0xSender' + Math.random().toString(36).substring(7) : walletAddress,
            to: isTokenReceived ? walletAddress : '0xRecipient' + Math.random().toString(36).substring(7),
            value: (Math.random() * 500).toFixed(2),
            timestamp: Date.now() - 7200000, // 2 hours ago
            isError: false,
            tokenName: 'Tether USD',
            tokenSymbol: 'USDT',
            logoUrl: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
            type: 'ERC20 Transfer',
            blockNumber: Math.floor(Math.random() * 1000000),
          };
          mockTxs.push(erc20Tx);
          log.push(`\n✅ ERC20 Token Transaction Created:`);
          log.push(`   - Token: ${erc20Tx.tokenName} (${erc20Tx.tokenSymbol})`);
          log.push(`   - Amount: ${erc20Tx.value}`);
          log.push(`   - Type: ${erc20Tx.type}`);
          log.push(`   - Logo: ${erc20Tx.logoUrl}`);
          console.log(`   ✅ Added ERC20 token (USDT) transaction`);
        }
        
        // Store in cache with REAL wallet address (expires after 30 minutes by default)
        const cacheKey = `${chainKey}:${walletAddress}`;
        await transactionCache.set(cacheKey, mockTxs, 30 * 60 * 1000);
        
        log.push(`\n✅ Cached ${mockTxs.length} transaction(s) for ${chainKey}`);
        log.push(`   - Cache Key: ${cacheKey.substring(0, 30)}...`);
        log.push(`   - Expiry: 30 minutes`);
        console.log(`   ✅ Cached ${mockTxs.length} mock transactions for ${chainKey}`);
        
        mockData[chainKey] = mockTxs;
        successCount++;
        
      } catch (error) {
        log.push(`\n❌ ERROR for ${chainKey}:`);
        log.push(`   ${error instanceof Error ? error.message : String(error)}`);
        console.error(`   ❌ Failed to create mock transactions for ${chainKey}:`, error);
      }
    }
    
    log.push(`\n${'='.repeat(60)}`);
    log.push(`🎉 SUMMARY`);
    log.push(`${'='.repeat(60)}`);
    log.push(`✅ Success: ${successCount}/${chains.length} chains`);
    log.push(`❌ Failed: ${chains.length - successCount} chains`);
    log.push(`📊 Total Transactions: ${Object.values(mockData).flat().length}`);
    log.push(`\n💡 TIP: Switch to any chain and check the History tab!`);
    log.push(`🧹 CLEANUP: Transactions auto-expire in 30 minutes`);
    log.push(`\n📅 Completed: ${new Date().toISOString()}`);
    
    console.log(`\n🎉 Added mock transactions to ${successCount}/${chains.length} chains!`);
    console.log('💡 TIP: Switch to any chain and check the History tab to see the mock transactions!');
    console.log('🧹 CLEANUP: Mock transactions will auto-expire in 30 minutes or when you clear cache.');
    
    setDetailedLog(log);
    setAddingMockData(false);
    alert(`✅ Added mock transactions to ${successCount} chains!\n\n` +
          `Go to History tab to see them with proper token names & logos.\n\n` +
          `They will auto-expire in 30 minutes.`);
  };

  const copyLogToClipboard = () => {
    const logText = detailedLog.join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      alert('✅ Log copied to clipboard!');
    }).catch(() => {
      alert('❌ Failed to copy log');
    });
  };

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
              {/* Detailed Log Panel */}
              {showLog && detailedLog.length > 0 && (
                <div className="mb-4 border border-gray-300 rounded-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Beaker className="w-4 h-4" />
                      <span className="font-semibold">Detailed Log</span>
                    </div>
                    <button
                      onClick={copyLogToClipboard}
                      className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm flex items-center gap-2 transition-all"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Log
                    </button>
                  </div>
                  <div className="bg-gray-50 p-4 max-h-64 overflow-y-auto font-mono text-xs text-gray-800">
                    {detailedLog.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.length === 0 ? (
                <div className="text-center py-8">
                  <Beaker className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">
                    Test transaction history metadata<br />for all 18 chains
                  </p>
                  
                  {/* Add Mock Data Button */}
                  <button
                    onClick={addMockTransactions}
                    disabled={addingMockData}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 mb-3"
                  >
                    {addingMockData ? (
                      <span className="flex items-center gap-2 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Adding mock data...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 justify-center">
                        <Plus className="w-4 h-4" />
                        Add Mock Transactions
                      </span>
                    )}
                  </button>
                  
                  <div className="text-xs text-gray-500 mb-3 bg-blue-50 p-3 rounded-lg">
                    💡 Click above to add fake transactions to ALL chains. Then check the History tab to see if token names & logos display correctly!
                  </div>
                  
                  {/* Start Test Button */}
                  <button
                    onClick={runTests}
                    disabled={testing}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {testing ? (
                      <span className="flex items-center gap-2 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Testing...
                      </span>
                    ) : (
                      'Test with Real API'
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

