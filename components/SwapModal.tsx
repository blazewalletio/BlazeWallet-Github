'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ArrowUpDown, 
  Loader2, 
  Check, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  ChevronDown,
  Info
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { CHAINS } from '@/lib/chains';
import { getLiFiChainId, isSolanaChainId } from '@/lib/lifi-chain-ids';
import { LiFiService, LiFiToken, LiFiQuote } from '@/lib/lifi-service';
import { logger } from '@/lib/logger';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { apiPost } from '@/lib/api-client';
import { ethers } from 'ethers';
import { Connection, Transaction, VersionedTransaction, MessageV0 } from '@solana/web3.js';
import { SolanaService } from '@/lib/solana-service';
import TokenSearchModal from './TokenSearchModal';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillData?: {
    fromToken?: string;
    toToken?: string;
    amount?: string;
  };
}

type SwapStep = 'input' | 'review' | 'executing' | 'success' | 'error';

export default function SwapModal({ isOpen, onClose, prefillData }: SwapModalProps) {
  useBlockBodyScroll(isOpen);

  // Wallet state
  const { wallet, currentChain, getCurrentAddress, mnemonic } = useWalletStore();
  const walletAddress = getCurrentAddress();
  const { solanaAddress, address: evmAddress } = useWalletStore();
  
  // ✅ Helper to get the correct address for a chain
  const getAddressForChain = (chainKey: string): string | null => {
    if (chainKey === 'solana') {
      return solanaAddress || walletAddress;
    }
    return evmAddress || walletAddress;
  };

  // UI State
  const [step, setStep] = useState<SwapStep>('input');
  const [fromChain, setFromChain] = useState<string>(currentChain);
  const [toChain, setToChain] = useState<string>(currentChain);
  const [fromToken, setFromToken] = useState<LiFiToken | 'native' | null>(null);
  const [toToken, setToToken] = useState<LiFiToken | 'native' | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5); // 0.5% default
  const [showFromTokenModal, setShowFromTokenModal] = useState(false);
  const [showToTokenModal, setShowToTokenModal] = useState(false);
  const [showFromChainDropdown, setShowFromChainDropdown] = useState(false);
  const [showToChainDropdown, setShowToChainDropdown] = useState(false);

  // Quote & Transaction State
  const [quote, setQuote] = useState<LiFiQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStep, setExecutionStep] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCrossChain, setIsCrossChain] = useState(false);

  // Initialize with prefill data
  useEffect(() => {
    if (isOpen && prefillData) {
      if (prefillData.fromToken) {
        // Try to find token or set as native
        if (prefillData.fromToken === 'native') {
          setFromToken('native');
        }
      }
      if (prefillData.toToken) {
        if (prefillData.toToken === 'native') {
          setToToken('native');
        }
      }
      if (prefillData.amount) {
        setAmount(prefillData.amount);
      }
    }
  }, [isOpen, prefillData]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setAmount('');
      setQuote(null);
      setQuoteError(null);
      setError(null);
      setTxHash(null);
      setIsExecuting(false);
      setExecutionStep(0);
      setTotalSteps(0);
      setFromChain(currentChain);
      setToChain(currentChain);
      setShowFromChainDropdown(false);
      setShowToChainDropdown(false);
    }
  }, [isOpen, currentChain]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.chain-dropdown-container')) {
        setShowFromChainDropdown(false);
        setShowToChainDropdown(false);
      }
    };

    if (showFromChainDropdown || showToChainDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showFromChainDropdown, showToChainDropdown]);

  // Fetch quote when inputs change
  useEffect(() => {
    if (
      isOpen &&
      step === 'input' &&
      fromToken &&
      toToken &&
      amount &&
      parseFloat(amount) > 0 &&
      walletAddress
    ) {
      const debounceTimer = setTimeout(() => {
        fetchQuote();
      }, 500); // Debounce 500ms

      return () => clearTimeout(debounceTimer);
    }
  }, [fromToken, toToken, amount, fromChain, toChain, slippage, walletAddress, isOpen, step]);

  const fetchQuote = async () => {
    if (!fromToken || !toToken || !amount || !walletAddress) return;

    setIsLoadingQuote(true);
    setQuoteError(null);

    try {
      const fromChainId = getLiFiChainId(fromChain);
      const toChainId = getLiFiChainId(toChain);
      
      // Check if cross-chain
      setIsCrossChain(fromChainId !== toChainId);

      const fromTokenAddress = fromToken === 'native' 
        ? 'native' 
        : fromToken.address;
      const toTokenAddress = toToken === 'native' 
        ? 'native' 
        : toToken.address;

      // Convert amount to smallest unit
      const decimals = fromToken === 'native' 
        ? CHAINS[fromChain]?.nativeCurrency?.decimals || 18
        : fromToken.decimals;
      const amountInSmallestUnit = ethers.parseUnits(amount, decimals).toString();

      logger.log('📊 Fetching swap quote:', {
        fromChain: fromChainId,
        toChain: toChainId,
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        amount: amountInSmallestUnit,
      });

      // ✅ For cross-chain swaps, determine the correct source and destination addresses
      // Source address: address on fromChain
      // Destination address: address on toChain
      const isCrossChainSwap = fromChainId !== toChainId;
      const sourceAddress = getAddressForChain(fromChain) || walletAddress;
      const destinationAddress = isCrossChainSwap 
        ? (getAddressForChain(toChain) || walletAddress)
        : sourceAddress;
      
      if (isCrossChainSwap) {
        logger.log('🌉 Cross-chain swap detected:', {
          fromChain: fromChainId,
          toChain: toChainId,
          sourceAddress: sourceAddress?.substring(0, 10) + '...',
          destinationAddress: destinationAddress?.substring(0, 10) + '...',
        });
      }

      const response = await fetch(
        `/api/lifi/quote?` +
        `fromChain=${fromChainId}&` +
        `toChain=${toChainId}&` +
        `fromToken=${fromTokenAddress}&` +
        `toToken=${toTokenAddress}&` +
        `fromAmount=${amountInSmallestUnit}&` +
        `fromAddress=${sourceAddress}&` +
        `toAddress=${destinationAddress}&` +
        `slippage=${slippage / 100}&` +
        `order=RECOMMENDED`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to fetch quote');
      }

      const data = await response.json();
      
      if (!data.success || !data.quote) {
        throw new Error('No quote available for this swap');
      }

      setQuote(data.quote);
      logger.log('✅ Quote received:', {
        tool: data.quote.tool,
        steps: data.quote.steps?.length || 0,
        toAmount: data.quote.estimate?.toAmount,
      });
    } catch (error: any) {
      logger.error('❌ Quote error:', error);
      setQuoteError(error.message || 'Failed to fetch quote');
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleSwap = async () => {
    if (!quote || !wallet || !mnemonic || !walletAddress) {
      setError('Wallet not available. Please unlock your wallet.');
      return;
    }

    setStep('executing');
    setIsExecuting(true);
    setError(null);
    setExecutionStep(0);

    try {
      // ✅ According to LI.FI docs: /v1/quote returns a Step object with transactionRequest already populated
      // If quote has steps array, it's a multi-step swap (from /v1/advanced/routes)
      // Otherwise, it's a single Step from /v1/quote
      const steps = (quote as any).steps || [quote];
      setTotalSteps(steps.length);

      // Execute each step sequentially
      for (let i = 0; i < steps.length; i++) {
        setExecutionStep(i + 1);
        
        const step = steps[i];
        
        // ✅ Check if step already has transactionRequest (from /v1/quote)
        // If not, call /v1/advanced/stepTransaction to populate it (for /v1/advanced/routes)
        let txRequest = step.transactionRequest;
        
        if (!txRequest) {
          // Step doesn't have transactionRequest, need to populate it
          logger.log('📝 Step missing transactionRequest, calling stepTransaction...');
          
          const executeResponse = await apiPost('/api/lifi/execute', { step });
          
          if (!executeResponse.ok) {
            const errorData = await executeResponse.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.details || 'Failed to get transaction data');
          }

          const executeData = await executeResponse.json();
          if (!executeData.success || !executeData.transaction) {
            throw new Error('Failed to get transaction data');
          }

          // ✅ executeData.transaction is a Step object with transactionRequest populated
          const populatedStep = executeData.transaction;
          txRequest = populatedStep.transactionRequest;

          if (!txRequest) {
            throw new Error('No transaction request in response');
          }
        } else {
          logger.log('✅ Step already has transactionRequest, using directly');
        }

        // Store transaction hash for status polling (used for both EVM and Solana)
        let stepTxHash: string | null = null;

        // Get provider for the chain
        // For cross-chain, use the chain of the current step
        const stepChainId = step.action?.fromChainId;
        
        // ✅ CRITICAL: Map LI.FI chain IDs to our chain keys
        // Solana: LI.FI uses "1151111081099710" (string), our CHAINS uses 101 (number)
        let stepChainKey: string | undefined;
        
        // ✅ Use helper function for Solana detection
        if (isSolanaChainId(stepChainId)) {
          stepChainKey = 'solana';
        } else {
          // For EVM chains, find by numeric ID
          const numericChainId = typeof stepChainId === 'number' 
            ? stepChainId 
            : parseInt(stepChainId.toString());
          
          stepChainKey = Object.keys(CHAINS).find(
            key => CHAINS[key].id === numericChainId || CHAINS[key].id === stepChainId
          );
        }
        
        // Fallback to fromChain if not found
        if (!stepChainKey) {
          logger.warn(`⚠️ Chain ID ${stepChainId} not found in CHAINS, using fromChain: ${fromChain}`);
          stepChainKey = fromChain;
        }
        
        const chainConfig = CHAINS[stepChainKey];
        if (!chainConfig) {
          throw new Error(`Chain ${stepChainKey} (ID: ${stepChainId}) not supported. Available chains: ${Object.keys(CHAINS).join(', ')}`);
        }
        
        logger.log(`🔗 Executing step on chain: ${stepChainKey} (ID: ${stepChainId})`);

        // ✅ CRITICAL: Solana requires different handling
        // LI.FI returns quotes for Solana, but transaction execution requires Solana web3.js, not ethers.js
        const isSolanaStep = stepChainKey === 'solana' || isSolanaChainId(stepChainId);
        
        if (isSolanaStep) {
          // ✅ Execute Solana transaction using @solana/web3.js
          if (!mnemonic) {
            throw new Error('Mnemonic required for Solana transaction execution');
          }

          logger.log('🪐 Executing Solana transaction via LI.FI...');
          
          // Create Solana connection
          const solanaService = new SolanaService(chainConfig.rpcUrl);
          const connection = new Connection(chainConfig.rpcUrl, 'confirmed');
          
          // Derive Solana keypair from mnemonic
          const keypair = solanaService.deriveKeypairFromMnemonic(mnemonic, 0);
          
          // ✅ LI.FI returns base64-encoded Solana transaction in transactionRequest.data
          // Deserialize and sign the transaction
          if (!txRequest.data) {
            throw new Error('No transaction data in Solana transactionRequest');
          }

          try {
            // ✅ LI.FI returns Solana transaction in transactionRequest.data
            // It could be base64-encoded or hex-encoded
            let transactionBuffer: Buffer;
            
            try {
              // Try base64 first (most common for Solana)
              transactionBuffer = Buffer.from(txRequest.data, 'base64');
            } catch {
              // Fallback to hex if base64 fails
              try {
                transactionBuffer = Buffer.from(txRequest.data.replace('0x', ''), 'hex');
              } catch {
                throw new Error('Invalid transaction data format. Expected base64 or hex.');
              }
            }

            // Try to deserialize as VersionedTransaction (newer format, preferred)
            let solanaTransaction: Transaction | VersionedTransaction;
            let isVersioned = false;
            
            try {
              solanaTransaction = VersionedTransaction.deserialize(transactionBuffer);
              isVersioned = true;
              logger.log('✅ Deserialized as VersionedTransaction');
            } catch {
              // Fallback to legacy Transaction format
              try {
                solanaTransaction = Transaction.from(transactionBuffer);
                logger.log('✅ Deserialized as legacy Transaction');
              } catch (error: any) {
                logger.error('❌ Failed to deserialize Solana transaction:', error);
                throw new Error(`Failed to deserialize Solana transaction: ${error.message || 'Unknown error'}`);
              }
            }

            // ✅ CRITICAL: Get fresh blockhash before sending
            // Solana blockhashes expire quickly (~1 minute), so we need a fresh one
            logger.log('🔄 Fetching fresh blockhash...');
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            logger.log(`✅ Got fresh blockhash: ${blockhash.substring(0, 16)}...`);

            // ✅ Update blockhash for legacy Transaction
            if (!isVersioned && solanaTransaction instanceof Transaction) {
              solanaTransaction.recentBlockhash = blockhash;
              solanaTransaction.lastValidBlockHeight = lastValidBlockHeight;
              logger.log('✅ Updated legacy Transaction with fresh blockhash');
            } else if (isVersioned && solanaTransaction instanceof VersionedTransaction) {
              // ⚠️ VersionedTransaction blockhash is embedded in the compiled message
              // We cannot easily update it without rebuilding the entire transaction
              // The transaction from LI.FI should have a recent blockhash, but if it's expired,
              // we'll get an error and handle it below
              logger.log('⚠️ VersionedTransaction - blockhash update requires full rebuild (will retry if needed)');
            }

            // Sign the transaction with our keypair
            if (solanaTransaction instanceof VersionedTransaction) {
              solanaTransaction.sign([keypair]);
              logger.log('✅ Signed VersionedTransaction');
            } else {
              solanaTransaction.sign(keypair);
              logger.log('✅ Signed legacy Transaction');
            }

            logger.log('📤 Sending Solana transaction...');
            
            // Send transaction with retry logic for expired blockhash
            let signature: string | null = null;
            let sendAttempts = 0;
            const maxSendAttempts = 2;
            
            while (sendAttempts < maxSendAttempts) {
              try {
                if (solanaTransaction instanceof VersionedTransaction) {
                  // VersionedTransaction is already signed, just send
                  signature = await connection.sendTransaction(solanaTransaction, {
                    skipPreflight: false,
                    maxRetries: 3,
                  });
                  logger.log('✅ VersionedTransaction sent');
                  break;
                } else {
                  // Legacy Transaction - send with signers
                  signature = await connection.sendTransaction(solanaTransaction, [keypair], {
                    skipPreflight: false,
                    maxRetries: 3,
                  });
                  logger.log('✅ Legacy Transaction sent');
                  break;
                }
              } catch (error: any) {
                sendAttempts++;
                const errorMessage = error.message || error.toString();
                
                // Check if error is due to expired blockhash
                if (errorMessage.includes('Blockhash not found') || errorMessage.includes('blockhash')) {
                  if (sendAttempts < maxSendAttempts) {
                    logger.log(`⚠️ Blockhash expired, fetching new one (attempt ${sendAttempts}/${maxSendAttempts})...`);
                    const { blockhash: newBlockhash, lastValidBlockHeight: newLastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
                    
                    if (solanaTransaction instanceof Transaction) {
                      solanaTransaction.recentBlockhash = newBlockhash;
                      solanaTransaction.lastValidBlockHeight = newLastValidBlockHeight;
                      logger.log('✅ Updated Transaction with fresh blockhash, retrying...');
                      // Re-sign with new blockhash
                      solanaTransaction.sign(keypair);
                    } else if (solanaTransaction instanceof VersionedTransaction) {
                      // ✅ For VersionedTransaction, rebuild with fresh blockhash
                      logger.log('🔄 Rebuilding VersionedTransaction with fresh blockhash...');
                      
                      // Extract message from original transaction
                      const originalMessage = solanaTransaction.message;
                      
                      // Rebuild MessageV0 with fresh blockhash
                      const newMessage = new MessageV0({
                        header: originalMessage.header,
                        staticAccountKeys: originalMessage.staticAccountKeys,
                        recentBlockhash: newBlockhash,
                        compiledInstructions: originalMessage.compiledInstructions,
                        addressTableLookups: originalMessage.addressTableLookups || [],
                      });
                      
                      // Create new VersionedTransaction with fresh blockhash
                      solanaTransaction = new VersionedTransaction(newMessage);
                      
                      // Re-sign the transaction
                      solanaTransaction.sign([keypair]);
                      logger.log('✅ Rebuilt and re-signed VersionedTransaction with fresh blockhash');
                    }
                  } else {
                    throw error;
                  }
                } else {
                  // Other errors, throw immediately
                  throw error;
                }
              }
            }

            if (!signature) {
              throw new Error('Failed to send Solana transaction after retries');
            }
            
            logger.log(`⏳ Waiting for Solana confirmation: ${signature}...`);
            
            // ✅ Use polling instead of WebSocket to avoid CSP issues
            // Poll for transaction status instead of using confirmTransaction (which uses WebSocket)
            const maxAttempts = 60; // 60 attempts = 60 seconds max
            let confirmed = false;
            let transactionError: any = null;
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              try {
                const status = await connection.getSignatureStatus(signature);
                
                if (status?.value) {
                  if (status.value.err) {
                    transactionError = status.value.err;
                    throw new Error(`Solana transaction failed: ${JSON.stringify(status.value.err)}`);
                  }
                  
                  if (status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized') {
                    confirmed = true;
                    logger.log(`✅ Solana transaction confirmed (attempt ${attempt + 1})`);
                    break;
                  }
                }
                
                // Wait 1 second before next poll
                await new Promise(resolve => setTimeout(resolve, 1000));
              } catch (error: any) {
                if (transactionError) {
                  throw error; // Re-throw transaction errors immediately
                }
                // Continue polling on network errors
                logger.log(`⏳ Polling attempt ${attempt + 1}/${maxAttempts}...`);
              }
            }
            
            if (!confirmed && !transactionError) {
              // Transaction might still be pending, but we'll consider it sent
              // User can check the signature on Solana Explorer
              logger.warn(`⚠️ Solana transaction not confirmed after ${maxAttempts} seconds, but signature is: ${signature}`);
              // Don't throw error - transaction might still succeed
            }

            logger.log('✅ Solana transaction confirmed');
            stepTxHash = signature;
            setTxHash(signature);
          } catch (error: any) {
            logger.error('❌ Solana transaction error:', error);
            throw new Error(`Solana transaction failed: ${error.message || 'Unknown error'}`);
          }
        } else {
          // ✅ EVM chains: Use ethers.js
          const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
          
          // Connect wallet to provider
          const connectedWallet = wallet.connect(provider);

          // Check if approval is needed
          const approvalAddress = step.estimate?.approvalAddress;
          if (approvalAddress && approvalAddress !== '0x0000000000000000000000000000000000000000') {
            logger.log('🔐 Approval needed, checking current allowance...');
            
            // Check current allowance
            const tokenAddress = step.action?.fromToken?.address;
            if (tokenAddress && tokenAddress !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
              const erc20ABI = [
                'function allowance(address owner, address spender) view returns (uint256)',
                'function approve(address spender, uint256 amount) returns (bool)',
              ];
              const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, connectedWallet);
              
              const currentAllowance = await tokenContract.allowance(walletAddress, approvalAddress);
              const requiredAmount = BigInt(step.action?.fromAmount || '0');

              if (currentAllowance < requiredAmount) {
                logger.log('🔐 Approving token...');
                const approveTx = await tokenContract.approve(approvalAddress, requiredAmount);
                await approveTx.wait();
                logger.log('✅ Token approved');
              }
            }
          }

          // Execute transaction
          logger.log('📤 Sending EVM transaction...');
          const tx = await connectedWallet.sendTransaction({
            to: txRequest.to,
            data: txRequest.data,
            value: txRequest.value || '0',
            gasLimit: txRequest.gasLimit || undefined,
            gasPrice: txRequest.gasPrice ? BigInt(txRequest.gasPrice) : undefined,
          });

          logger.log('⏳ Waiting for confirmation...');
          const receipt = await tx.wait();
          
          if (!receipt) {
            throw new Error('Transaction receipt is null');
          }

          stepTxHash = receipt.hash;
          setTxHash(receipt.hash);
        }

        // If this is the last step and it's cross-chain, start status polling
        if (i === steps.length - 1 && isCrossChain && stepTxHash) {
          // Start polling for cross-chain status
          pollTransactionStatus(stepTxHash, step.tool || 'unknown');
        }
      }

      setStep('success');
    } catch (error: any) {
      logger.error('❌ Swap execution error:', error);
      setError(error.message || 'Transaction failed');
      setStep('error');
    } finally {
      setIsExecuting(false);
    }
  };

  const pollTransactionStatus = async (hash: string, bridge: string) => {
    // Poll status for cross-chain swaps
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        logger.warn('⏱️ Status polling timeout');
        return;
      }

      attempts++;

      try {
        const fromChainId = getLiFiChainId(fromChain);
        const toChainId = getLiFiChainId(toChain);

        const response = await fetch(
          `/api/lifi/status?` +
          `txHash=${hash}&` +
          `bridge=${bridge}&` +
          `fromChain=${fromChainId}&` +
          `toChain=${toChainId}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.status) {
            if (data.status.status === 'DONE') {
              logger.log('✅ Cross-chain swap completed');
              return;
            } else if (data.status.status === 'FAILED') {
              throw new Error('Cross-chain swap failed');
            }
          }
        }

        // Continue polling
        setTimeout(poll, 5000); // Poll every 5 seconds
      } catch (error) {
        logger.error('❌ Status polling error:', error);
      }
    };

    poll();
  };

  const formatAmount = (amount: string, decimals: number): string => {
    try {
      const formatted = ethers.formatUnits(amount, decimals);
      const num = parseFloat(formatted);
      if (num < 0.0001) return '<0.0001';
      return num.toFixed(6).replace(/\.?0+$/, '');
    } catch {
      return amount;
    }
  };

  const getTokenDisplay = (token: LiFiToken | 'native' | null, chain: string) => {
    if (!token) return { symbol: 'Select', name: 'Select token', logo: '' };
    if (token === 'native') {
      const chainConfig = CHAINS[chain];
      return {
        symbol: chainConfig?.nativeCurrency?.symbol || 'ETH',
        name: chainConfig?.nativeCurrency?.name || 'Native',
        logo: chainConfig?.logoUrl || `/crypto-${chain}.png` || '',
      };
    }
    return {
      symbol: token.symbol,
      name: token.name,
      logo: token.logoURI || '',
    };
  };

  const fromTokenDisplay = getTokenDisplay(fromToken, fromChain);
  const toTokenDisplay = getTokenDisplay(toToken, toChain);

  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      >
        <div className="min-h-full flex flex-col">
          <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-safe pb-safe">
            <div className="pt-4 pb-2">
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
              >
                ← Back
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ArrowUpDown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Swap</h2>
                  <p className="text-sm text-gray-600">
                    {isCrossChain ? 'Cross-chain swap with automatic bridging' : 'Swap tokens instantly'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 pb-6">
              <div className="glass-card p-6 space-y-6">
              {step === 'input' && (
                <div className="space-y-6">
                  {/* From Token */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">From</label>
                    <div className="flex gap-3">
                      {/* Chain Selector */}
                      <div className="relative chain-dropdown-container">
                        <button
                          onClick={() => {
                            setShowFromChainDropdown(!showFromChainDropdown);
                            setShowToChainDropdown(false); // Close other dropdown
                          }}
                          className="px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-2 min-w-[120px]"
                        >
                          <span className="text-sm font-semibold text-gray-900">
                            {CHAINS[fromChain]?.shortName || fromChain}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showFromChainDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showFromChainDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden"
                          >
                            {Object.keys(CHAINS)
                              .filter(c => 
                                !CHAINS[c].isTestnet && 
                                ['ethereum', 'polygon', 'arbitrum', 'base', 'bsc', 'optimism', 'avalanche', 'solana'].includes(c)
                              )
                              .map((chainKey) => {
                                const chain = CHAINS[chainKey];
                                return (
                                  <button
                                    key={chainKey}
                                    onClick={() => {
                                      setFromChain(chainKey);
                                      setShowFromChainDropdown(false);
                                      // Reset token when chain changes
                                      setFromToken(null);
                                    }}
                                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                                      fromChain === chainKey ? 'bg-orange-50' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {chain.logoUrl ? (
                                        <img 
                                          src={chain.logoUrl} 
                                          alt={chain.name}
                                          className="w-6 h-6 rounded-full"
                                        />
                                      ) : (
                                        <span className="text-xl">{chain.icon}</span>
                                      )}
                                      <span className="font-medium text-gray-900">{chain.name}</span>
                                    </div>
                                    {fromChain === chainKey && (
                                      <Check className="w-5 h-5 text-orange-500" />
                                    )}
                                  </button>
                                );
                              })}
                          </motion.div>
                        )}
                      </div>

                      {/* Token Selector */}
                      <button
                        onClick={() => setShowFromTokenModal(true)}
                        className="flex-1 px-4 py-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200">
                            {fromTokenDisplay.logo && (fromTokenDisplay.logo.startsWith('http') || fromTokenDisplay.logo.startsWith('/')) ? (
                              <img 
                                src={fromTokenDisplay.logo} 
                                alt={fromTokenDisplay.symbol}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.parentElement) {
                                    e.currentTarget.parentElement.textContent = fromTokenDisplay.symbol[0];
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-sm font-bold text-gray-700">{fromTokenDisplay.symbol[0]}</span>
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">{fromTokenDisplay.symbol}</div>
                            <div className="text-xs text-gray-500">{fromTokenDisplay.name}</div>
                          </div>
                        </div>
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>

                    {/* Amount Input */}
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0"
                      className="w-full px-4 py-4 text-2xl font-bold text-gray-900 bg-gray-50 rounded-xl border-2 border-transparent focus:border-purple-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Swap Button */}
                  <button
                    onClick={() => {
                      const tempChain = fromChain;
                      const tempToken = fromToken;
                      setFromChain(toChain);
                      setToChain(tempChain);
                      setFromToken(toToken);
                      setToToken(tempToken);
                    }}
                    className="mx-auto -my-3 relative z-10 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110"
                  >
                    <ArrowUpDown className="w-5 h-5 text-purple-600" />
                  </button>

                  {/* To Token */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">To</label>
                    <div className="flex gap-3">
                      {/* Chain Selector */}
                      <div className="relative chain-dropdown-container">
                        <button
                          onClick={() => {
                            setShowToChainDropdown(!showToChainDropdown);
                            setShowFromChainDropdown(false); // Close other dropdown
                          }}
                          className="px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-2 min-w-[120px]"
                        >
                          <span className="text-sm font-semibold text-gray-900">
                            {CHAINS[toChain]?.shortName || toChain}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showToChainDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showToChainDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden"
                          >
                            {Object.keys(CHAINS)
                              .filter(c => 
                                !CHAINS[c].isTestnet && 
                                ['ethereum', 'polygon', 'arbitrum', 'base', 'bsc', 'optimism', 'avalanche', 'solana'].includes(c)
                              )
                              .map((chainKey) => {
                                const chain = CHAINS[chainKey];
                                return (
                                  <button
                                    key={chainKey}
                                    onClick={() => {
                                      setToChain(chainKey);
                                      setShowToChainDropdown(false);
                                      // Reset token when chain changes
                                      setToToken(null);
                                    }}
                                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                                      toChain === chainKey ? 'bg-orange-50' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {chain.logoUrl ? (
                                        <img 
                                          src={chain.logoUrl} 
                                          alt={chain.name}
                                          className="w-6 h-6 rounded-full"
                                        />
                                      ) : (
                                        <span className="text-xl">{chain.icon}</span>
                                      )}
                                      <span className="font-medium text-gray-900">{chain.name}</span>
                                    </div>
                                    {toChain === chainKey && (
                                      <Check className="w-5 h-5 text-orange-500" />
                                    )}
                                  </button>
                                );
                              })}
                          </motion.div>
                        )}
                      </div>

                      {/* Token Selector */}
                      <button
                        onClick={() => setShowToTokenModal(true)}
                        className="flex-1 px-4 py-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl hover:from-emerald-100 hover:to-teal-100 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200">
                            {toTokenDisplay.logo && (toTokenDisplay.logo.startsWith('http') || toTokenDisplay.logo.startsWith('/')) ? (
                              <img 
                                src={toTokenDisplay.logo} 
                                alt={toTokenDisplay.symbol}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.parentElement) {
                                    e.currentTarget.parentElement.textContent = toTokenDisplay.symbol[0];
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-sm font-bold text-gray-700">{toTokenDisplay.symbol[0]}</span>
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">{toTokenDisplay.symbol}</div>
                            <div className="text-xs text-gray-500">{toTokenDisplay.name}</div>
                          </div>
                        </div>
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>

                    {/* Quote Display */}
                    {isLoadingQuote && (
                      <div className="px-4 py-3 bg-gray-50 rounded-xl flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        <span className="text-sm text-gray-600">Fetching best rate...</span>
                      </div>
                    )}

                    {quote && !isLoadingQuote && (
                      <div className="px-4 py-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
                        <div className="text-sm text-gray-600 mb-1">You will receive</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {formatAmount(
                            quote.estimate?.toAmount || '0',
                            toToken === 'native' 
                              ? CHAINS[toChain]?.nativeCurrency?.decimals || 18
                              : toToken?.decimals || 18
                          )} {toTokenDisplay.symbol}
                        </div>
                        {quote.estimate?.toAmountUSD && parseFloat(quote.estimate.toAmountUSD) > 0 && (
                          <div className="text-sm text-gray-500 mt-1">
                            ≈ ${parseFloat(quote.estimate.toAmountUSD).toFixed(2)}
                          </div>
                        )}
                        {isCrossChain && (
                          <div className="mt-2 pt-2 border-t border-purple-200">
                            <div className="flex items-center gap-2 text-xs text-purple-600">
                              <Info className="w-3 h-3" />
                              <span>Cross-chain swap via {quote.tool || 'bridge'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {quoteError && !isLoadingQuote && (
                      <div className="px-4 py-3 bg-red-50 rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-600">{quoteError}</span>
                      </div>
                    )}

                    {/* Slippage Settings */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-gray-600 flex items-center gap-1">
                          Slippage Tolerance
                          <Info className="w-3 h-3" />
                        </label>
                        <span className="text-xs font-semibold text-gray-900">{slippage}%</span>
                      </div>
                      <div className="flex gap-2">
                        {[0.1, 0.5, 1.0, 3.0].map((val) => (
                          <button
                            key={val}
                            onClick={() => setSlippage(val)}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                              slippage === val
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {val}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <button
                    onClick={() => {
                      if (quote) {
                        setStep('review');
                      }
                    }}
                    disabled={!quote || isLoadingQuote || !amount || parseFloat(amount) <= 0}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                  >
                    {isLoadingQuote ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Finding best rate...
                      </span>
                    ) : quote ? (
                      'Review Swap'
                    ) : (
                      'Enter Amount'
                    )}
                  </button>
                </div>
              )}

              {step === 'review' && quote && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Review Swap</h3>
                    <p className="text-sm text-gray-600">Please review your swap details</p>
                  </div>

                  {/* Swap Details */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">From</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {amount} {fromTokenDisplay.symbol}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">To</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatAmount(
                          quote.estimate?.toAmount || '0',
                          toToken === 'native' 
                            ? CHAINS[toChain]?.nativeCurrency?.decimals || 18
                            : toToken?.decimals || 18
                        )} {toTokenDisplay.symbol}
                      </span>
                    </div>
                    {isCrossChain && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <span className="text-sm text-gray-600">Route</span>
                        <span className="text-sm font-semibold text-purple-600">
                          {fromChain} → {toChain}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Slippage</span>
                      <span className="text-sm font-semibold text-gray-900">{slippage}%</span>
                    </div>
                    {quote.estimate?.gasCosts && quote.estimate.gasCosts.length > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <span className="text-sm text-gray-600">Estimated Gas</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {formatAmount(
                            quote.estimate.gasCosts[0].amount || '0',
                            quote.estimate.gasCosts[0].token.decimals || 18
                          )} {quote.estimate.gasCosts[0].token.symbol}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('input')}
                      className="flex-1 py-3 bg-gray-100 text-gray-900 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSwap}
                      className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
                    >
                      Confirm Swap
                    </button>
                  </div>
                </div>
              )}

              {step === 'executing' && (
                <div className="space-y-6 text-center">
                  <div className="flex justify-center">
                    <Loader2 className="w-16 h-16 animate-spin text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Processing Swap</h3>
                    <p className="text-sm text-gray-600">
                      {isCrossChain 
                        ? `Step ${executionStep} of ${totalSteps}: Bridging to ${toChain}...`
                        : 'Executing swap transaction...'
                      }
                    </p>
                    {totalSteps > 1 && (
                      <div className="mt-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(executionStep / totalSteps) * 100}%` }}
                            className="bg-purple-600 h-2 rounded-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 'success' && (
                <div className="space-y-6 text-center">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Swap Successful!</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Your swap has been completed successfully.
                    </p>
                    {txHash && (
                      <a
                        href={`${CHAINS[fromChain]?.explorerUrl}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-semibold"
                      >
                        View on Explorer <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      // Reset state
                      setStep('input');
                      setAmount('');
                      setQuote(null);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all"
                  >
                    Done
                  </button>
                </div>
              )}

              {step === 'error' && (
                <div className="space-y-6 text-center">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Swap Failed</h3>
                    <p className="text-sm text-red-600 mb-4">{error || 'An unknown error occurred'}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('input')}
                      className="flex-1 py-3 bg-gray-100 text-gray-900 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={onClose}
                      className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      )}

      {/* Token Selection Modals */}
      <TokenSearchModal
        isOpen={showFromTokenModal}
        onClose={() => setShowFromTokenModal(false)}
        chainKey={fromChain}
        selectedToken={fromToken === 'native' ? 'native' : fromToken?.address}
        onSelectToken={(token) => {
          setFromToken(token);
          setShowFromTokenModal(false);
        }}
        excludeTokens={toToken === 'native' ? [] : toToken ? [toToken.address] : []}
      />

      <TokenSearchModal
        isOpen={showToTokenModal}
        onClose={() => setShowToTokenModal(false)}
        chainKey={toChain}
        selectedToken={toToken === 'native' ? 'native' : toToken?.address}
        onSelectToken={(token) => {
          setToToken(token);
          setShowToTokenModal(false);
        }}
        excludeTokens={fromToken === 'native' ? [] : fromToken ? [fromToken.address] : []}
      />
    </AnimatePresence>
  );
}
