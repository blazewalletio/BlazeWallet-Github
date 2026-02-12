'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Repeat, 
  Loader2, 
  Check, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  ChevronDown,
  Info,
  Zap,
  TrendingDown,
  Clock
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { MultiChainService } from '@/lib/multi-chain-service';
import { CHAINS } from '@/lib/chains';
import { getLiFiChainId, isSolanaChainId } from '@/lib/lifi-chain-ids';
import { LiFiService, LiFiToken, LiFiQuote } from '@/lib/lifi-service';
import { isLiFiSupported } from '@/lib/popular-tokens';
import { logger } from '@/lib/logger';
import { logTransactionEvent, logFeatureUsage } from '@/lib/analytics-tracker';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { apiPost } from '@/lib/api-client';
import { ethers } from 'ethers';
import { Connection, Transaction, VersionedTransaction, MessageV0 } from '@solana/web3.js';
import { SolanaService } from '@/lib/solana-service';
import TokenSearchModal from './TokenSearchModal';
import SensitiveAction2FAModal from './SensitiveAction2FAModal';
import { getIPFSGatewayUrl, isIPFSUrl, initIPFSErrorSuppression } from '@/lib/ipfs-utils';
import { twoFactorSessionService } from '@/lib/2fa-session-service';
import { supabase } from '@/lib/supabase';

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

  // ✅ Initialize IPFS error suppression on mount
  useEffect(() => {
    initIPFSErrorSuppression();
  }, []);

  // 🔐 Load userId for 2FA checks
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (error) {
        logger.log('No Supabase user (seed wallet)');
      }
    };
    if (isOpen) {
      loadUserId();
    }
  }, [isOpen]);

  // Wallet state
  const { wallet, currentChain, getCurrentAddress, mnemonic, getChainTokens, tokens } = useWalletStore();
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
  const [fromToken, setFromToken] = useState<LiFiToken | 'native' | null>('native'); // ✅ FIX: Default to native token
  const [toToken, setToToken] = useState<LiFiToken | 'native' | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(1.0); // 1.0% default (increased for better success rate)
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

  // 🔐 2FA SESSION SHIELD states
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingSwapData, setPendingSwapData] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const isChainLiFiEligible = useCallback((chainKey: string): boolean => {
    const chain = CHAINS[chainKey];
    if (!chain) return false;
    return !chain.isTestnet && chain.chainType !== 'UTXO' && isLiFiSupported(chainKey);
  }, []);

  const getFallbackLiFiChain = useCallback((): string => {
    if (isChainLiFiEligible(currentChain)) return currentChain;

    if (isChainLiFiEligible('ethereum')) return 'ethereum';

    const firstSupported = Object.keys(CHAINS).find((chainKey) => isChainLiFiEligible(chainKey));
    return firstSupported || 'ethereum';
  }, [currentChain, isChainLiFiEligible]);

  // ✅ CRITICAL FIX: Reset toToken when toChain changes
  // This prevents using wrong token address (e.g. Ethereum USDC on BSC)
  useEffect(() => {
    if (toToken && toToken !== 'native') {
      // Clear toToken when chain changes to force reselection
      // This ensures user selects the correct chain-specific token
      setToToken(null);
      setQuote(null);
      setQuoteError(null);
    }
  }, [toChain]);

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
      const fallbackChain = getFallbackLiFiChain();
      setFromChain(fallbackChain);
      setToChain(fallbackChain);
      setShowFromChainDropdown(false);
      setShowToChainDropdown(false);
    }
  }, [isOpen, currentChain, getFallbackLiFiChain]);

  // Prevent unsupported chains (e.g. BTC native UTXO) from entering LiFi flow.
  useEffect(() => {
    if (!isOpen) return;

    const fallbackChain = getFallbackLiFiChain();

    if (!isChainLiFiEligible(fromChain)) {
      setFromChain(fallbackChain);
      setFromToken('native');
      setQuote(null);
      setQuoteError(null);
    }

    if (!isChainLiFiEligible(toChain)) {
      setToChain(fallbackChain);
      setToToken('native');
      setQuote(null);
      setQuoteError(null);
    }
  }, [isOpen, fromChain, toChain, isChainLiFiEligible, getFallbackLiFiChain]);

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
      if (!isChainLiFiEligible(fromChain) || !isChainLiFiEligible(toChain)) {
        throw new Error('This network pair is not supported for Li.Fi swaps yet. Please use Ethereum, Solana, or another supported EVM chain.');
      }

      // ⚠️ FANTOM CHECK: Li.Fi doesn't support Fantom (Chain ID 250)
      // See COMPLETE_CHAIN_ANALYSIS.md for details
      if (fromChain === 'fantom' || toChain === 'fantom') {
        throw new Error('Fantom swaps are temporarily unavailable. We\'re working on adding support!');
      }

      const fromChainId = getLiFiChainId(fromChain);
      const toChainId = getLiFiChainId(toChain);

      if (!fromChainId || !toChainId) {
        throw new Error('Selected network is not available for Li.Fi quotes. Please switch to a supported chain.');
      }
      
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

    // 🔐 SESSION SHIELD: Check if 2FA is required
    if (userId) {
      // Estimate USD value from quote
      const swapValueUSD = quote.estimate?.toAmountUSD 
        ? parseFloat(quote.estimate.toAmountUSD) 
        : 0;
      
      const sessionStatus = await twoFactorSessionService.checkActionRequires2FA(userId, {
        action: 'swap',
        amountUSD: swapValueUSD,
      });

      if (sessionStatus.required) {
        logger.log('🔒 2FA verification required for swap');
        
        // Store swap data to execute after 2FA
        setPendingSwapData({
          swapValueUSD,
        });
        
        // Show 2FA modal
        setShow2FAModal(true);
        return; // Wait for 2FA verification
      }

      logger.log('✅ 2FA session valid - proceeding with swap');
    }

    // Execute the swap
    await executeSwap();
  };

  // 🔐 Separated swap logic (called after 2FA if needed)
  const executeSwap = async () => {
    if (!quote || !wallet || !mnemonic || !walletAddress) {
      setError('Wallet not available. Please unlock your wallet.');
      return;
    }

    // ✅ Pre-check: Verify sufficient native token balance for gas
    try {
      const blockchain = MultiChainService.getInstance(fromChain);
      const nativeBalance = await blockchain.getBalance(walletAddress);
      const nativeBalanceNum = parseFloat(nativeBalance);
      const nativeCurrency = CHAINS[fromChain]?.nativeCurrency?.symbol || 'native token';
      
      // Estimate minimum gas needed (conservative estimate)
      const estimatedGasCost = fromChain === 'ethereum' ? 0.01 : 0.001; // ETH needs more, others less
      
      if (nativeBalanceNum < estimatedGasCost) {
        setError(`Insufficient ${nativeCurrency} for gas fees. You have ${nativeBalanceNum.toFixed(6)} ${nativeCurrency} but need at least ${estimatedGasCost} ${nativeCurrency} to pay for the transaction.`);
        setStep('error'); // ✅ Show error screen
        return;
      }
    } catch (err) {
      logger.warn('⚠️ Failed to check native balance:', err);
      // Continue anyway - let the actual transaction fail with proper error
    }

    setStep('executing');
    setIsExecuting(true);
    setError(null);
    setExecutionStep(0);

    // Track swap initiation
    await logTransactionEvent({
      eventType: 'swap_initiated',
      chainKey: fromChain,
      tokenSymbol: typeof fromToken === 'string' ? fromToken : ((fromToken as any)?.symbol || 'UNKNOWN'),
      valueUSD: 0, // Price not available in swap context
      status: 'pending',
      metadata: {
        fromToken: typeof fromToken === 'string' ? fromToken : (fromToken as any)?.symbol || 'unknown',
        toToken: typeof toToken === 'string' ? toToken : (toToken as any)?.symbol || 'unknown',
        fromAmount: amount,
        toChain,
      },
    });

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

          txRequest = executeData.transaction;
        }

        // Execute based on chain type
        let stepTxHash: string | null = null;

        // ✅ CRITICAL FIX: TRIPLE check for Solana to prevent ethers.js initialization
        // Check 1: Li.Fi response chain ID
        // Check 2: User-selected fromChain
        // Check 3: CHAINS config chainType (NEW!)
        const isFromSolana = 
          isSolanaChainId(step.action?.fromChainId) || 
          fromChain === 'solana' ||
          (CHAINS[fromChain] && CHAINS[fromChain].chainType === 'SOL');
        
        // ✅ CRITICAL DEBUG: Log step details to identify Solana vs EVM
        logger.log('🔍 [SwapModal] Executing step:', {
          fromChainId: step.action?.fromChainId,
          toChainId: step.action?.toChainId,
          fromChain,
          toChain,
          chainType: CHAINS[fromChain]?.chainType,
          check1_lifiChainId: isSolanaChainId(step.action?.fromChainId),
          check2_userChain: fromChain === 'solana',
          check3_chainType: CHAINS[fromChain]?.chainType === 'SOL',
          isFromSolana,
        });
        
        // ✅ CRITICAL ASSERTION: Ensure Solana is NEVER treated as EVM
        if (fromChain === 'solana' && !isFromSolana) {
          const errorMsg = '🚨 CRITICAL: Solana chain detection FAILED! This would cause ethers.js to initialize with Solana RPC!';
          logger.error(errorMsg, {
            fromChain,
            stepChainId: step.action?.fromChainId,
            chainType: CHAINS[fromChain]?.chainType
          });
          throw new Error(errorMsg);
        }

        if (isFromSolana) {
          // ✅ Solana transaction execution
          logger.log('🔵 Executing Solana transaction...');
          
          if (!solanaAddress) {
            throw new Error('Solana address not found');
          }

          // Get Solana service and connection
          const solanaService = new SolanaService();
          const connection = new Connection(CHAINS['solana'].rpcUrl, 'confirmed');

          // Get keypair from mnemonic
          const keypair = solanaService.deriveKeypairFromMnemonic(mnemonic);

          // Parse and send transaction
          const txData = txRequest.data;
          let transaction: Transaction | VersionedTransaction;
          
          // ✅ DEBUG: Log what Li.Fi actually returns
          logger.log('🔍 DEBUG: Li.Fi txData type:', typeof txData);
          logger.log('🔍 DEBUG: Li.Fi txData sample:', JSON.stringify(txData).substring(0, 200));
          logger.log('🔍 DEBUG: Full txRequest:', txRequest);
          
          try {
            // ✅ IMPROVED: Detect transaction format BEFORE deserializing
            logger.log('📦 Parsing Solana transaction data...');
            const buffer = Buffer.from(txData, 'base64');
            
            // Check transaction format by examining the buffer
            // Versioned transactions start with version byte (0x80 for v0, or 0xFF for legacy)
            const firstByte = buffer[0];
            
            // VersionedTransaction format: First byte is version (< 0x7F for versioned)
            // Legacy Transaction format: First byte is number of signatures (typically 1-2)
            const isVersioned = firstByte < 0x7F; // Versioned transactions have version as first byte (0 = v0)
            const isLegacy = firstByte >= 0x7F; // Legacy has signature count first (usually 1 or 2)
            
            logger.log(`🔍 Transaction format detection: firstByte=0x${firstByte.toString(16)}, isVersioned=${isVersioned}, isLegacy=${isLegacy}`);
            
            if (isVersioned) {
              // ✅ Versioned transaction or message - try both formats
              try {
                // First try: Complete VersionedTransaction
                transaction = VersionedTransaction.deserialize(buffer);
                logger.log('✅ Deserialized as VersionedTransaction (complete)');
              } catch (versionedTxError: any) {
                // If that fails, it might be just a VersionedMessage (needs wrapping)
                if (versionedTxError.message?.toLowerCase().includes('versioned') && 
                    versionedTxError.message?.toLowerCase().includes('message')) {
                  logger.log('📝 Data is VersionedMessage format - constructing VersionedTransaction');
                  const { VersionedMessage } = await import('@solana/web3.js');
                  const versionedMessage = VersionedMessage.deserialize(buffer);
                  transaction = new VersionedTransaction(versionedMessage);
                  logger.log('✅ Created VersionedTransaction from VersionedMessage');
                } else {
                  throw versionedTxError;
                }
              }
              
              // Sign versioned transaction
              transaction.sign([keypair]);
              logger.log('✅ Versioned transaction signed');
              
              // Send versioned transaction
              const signature = await connection.sendTransaction(transaction, {
                skipPreflight: false,
                maxRetries: 3,
              });
              
              // ✅ SPEED OPTIMIZATION: Don't wait for confirmation!
              // Show success immediately after transaction is sent
              stepTxHash = signature;
              setTxHash(signature);
              logger.log(`✅ Solana transaction sent: ${signature}`);
              logger.log('⚡ Transaction will be confirmed in background (~400ms for Solana)');
              
              // Optional: Confirm in background (don't await)
              connection.confirmTransaction(signature, 'confirmed').then(() => {
                logger.log(`✅ Transaction confirmed: ${signature}`);
              }).catch(err => {
                logger.warn('⚠️ Background confirmation failed:', err.message);
                // Transaction was already sent, so this is non-critical
              });
            } else {
              // ✅ Legacy transaction format
              logger.log('📦 Detected legacy Transaction format');
              transaction = Transaction.from(buffer);
              logger.log('✅ Deserialized as legacy Transaction');
              
              // Sign legacy transaction
              transaction.sign(keypair);
              logger.log('✅ Legacy transaction signed');
              
              // Send legacy transaction
              const signature = await connection.sendRawTransaction(transaction.serialize(), {
                skipPreflight: false,
                maxRetries: 3,
              });
              
              // ✅ SPEED OPTIMIZATION: Don't wait for confirmation!
              // Show success immediately after transaction is sent
              stepTxHash = signature;
              setTxHash(signature);
              logger.log(`✅ Solana legacy transaction sent: ${signature}`);
              logger.log('⚡ Transaction will be confirmed in background (~400ms for Solana)');
              
              // Optional: Confirm in background (don't await)
              connection.confirmTransaction(signature, 'confirmed').then(() => {
                logger.log(`✅ Transaction confirmed: ${signature}`);
              }).catch(err => {
                logger.warn('⚠️ Background confirmation failed:', err.message);
                // Transaction was already sent, so this is non-critical
              });
            }
          } catch (parseError: any) {
            // ❌ Parsing failed completely
            logger.error('❌ Failed to parse Solana transaction:', {
              error: parseError.message,
              stack: parseError.stack,
            });
            
            const errorMsg = `Failed to send Solana transaction: ${parseError.message || 'Unknown error'}`;
            setError(errorMsg);
            setStep('error');
            
            // Track failed transaction
            await logTransactionEvent({
              eventType: 'swap_failed',
              chainKey: fromChain,
              tokenSymbol: typeof fromToken === 'string' ? fromToken : ((fromToken as any)?.symbol || 'UNKNOWN'),
              valueUSD: 0,
              status: 'failed',
              metadata: {
                error: errorMsg,
                fromChain,
                toChain,
                fromToken: typeof fromToken === 'string' ? fromToken : (fromToken as any)?.symbol || 'unknown',
                toToken: typeof toToken === 'string' ? toToken : (toToken as any)?.symbol || 'unknown',
                amount: amount
              },
            });
            throw new Error(errorMsg);
          }
        } else {
          // ✅ EVM transaction execution
          logger.log('⚡ Executing EVM transaction...');
          
          // ✅ CRITICAL FIX: Only initialize EVM provider for EVM chains!
          // This was causing "eth_chainId is not available on SOLANA_MAINNET" error
          // because ethers.JsonRpcProvider was being initialized with Solana RPC URL
          if (!CHAINS[fromChain] || !CHAINS[fromChain].rpcUrl) {
            throw new Error(`Invalid chain configuration for ${fromChain}`);
          }
          
          const provider = new ethers.JsonRpcProvider(CHAINS[fromChain].rpcUrl);
          const connectedWallet = new ethers.Wallet(
            ethers.Wallet.fromPhrase(mnemonic).privateKey,
            provider
          );

          // Check if approval is needed
          if (step.estimate?.approvalAddress) {
            const tokenAddress = step.action?.fromToken?.address;
            const approvalAddress = step.estimate.approvalAddress;

            if (tokenAddress && tokenAddress !== ethers.ZeroAddress) {
              // Check current allowance
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

          // ✅ SPEED OPTIMIZATION: Don't wait for confirmation!
          // Show success immediately after transaction is sent to network
          // Confirmation happens in background (miners will process it)
          stepTxHash = tx.hash;
          setTxHash(tx.hash);
          logger.log(`✅ EVM transaction sent: ${tx.hash}`);
          logger.log('⚡ Transaction will be confirmed in background (~12s for Ethereum)');
          
          // Optional: Confirm in background (don't await)
          tx.wait().then(receipt => {
            if (receipt) {
              logger.log(`✅ Transaction confirmed: ${receipt.hash}`);
            }
          }).catch(err => {
            logger.warn('⚠️ Background confirmation failed:', err.message);
            // Transaction was already sent, so this is non-critical
          });
        }

        // If this is the last step and it's cross-chain, start status polling
        if (i === steps.length - 1 && isCrossChain && stepTxHash) {
          // Start polling for cross-chain status
          pollTransactionStatus(stepTxHash, step.tool || 'unknown');
        }
      }

      setStep('success');
      
      // Track successful swap
      await logTransactionEvent({
        eventType: 'swap_confirmed',
        chainKey: fromChain,
        tokenSymbol: typeof fromToken === 'string' ? fromToken : ((fromToken as any)?.symbol || 'UNKNOWN'),
        valueUSD: 0,
        status: 'success',
        referenceId: txHash || undefined,
        metadata: {
          fromToken: typeof fromToken === 'string' ? fromToken : (fromToken as any)?.symbol || 'unknown',
          toToken: typeof toToken === 'string' ? toToken : (toToken as any)?.symbol || 'unknown',
          fromAmount: amount,
          toChain,
        },
      });
      
    } catch (error: any) {
      logger.error('❌ Swap execution error:', error);
      
      // ✅ User-friendly error messages
      let userMessage = 'Transaction failed';
      const errorMsg = error.message?.toLowerCase() || '';
      
      if (errorMsg.includes('insufficient funds') && errorMsg.includes('intrinsic')) {
        // Not enough native currency (ETH/MATIC/etc) for gas fees
        const nativeCurrency = CHAINS[fromChain]?.nativeCurrency?.symbol || 'native token';
        userMessage = `Insufficient ${nativeCurrency} for gas fees. You need ${nativeCurrency} to pay for the transaction, even when swapping tokens.`;
      } else if (errorMsg.includes('insufficient funds') || errorMsg.includes('insufficient balance')) {
        userMessage = `Insufficient balance to complete this swap`;
      } else if (errorMsg.includes('user rejected') || errorMsg.includes('user denied')) {
        userMessage = 'Transaction was cancelled';
      } else if (errorMsg.includes('slippage')) {
        userMessage = 'Price changed too much. Try increasing slippage tolerance or refreshing the quote.';
      } else if (errorMsg.includes('execution reverted')) {
        userMessage = 'Transaction rejected by contract. Try refreshing the quote or adjusting the amount.';
      } else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message) {
        // Show original message if it's somewhat readable
        userMessage = error.message;
      }
      
      setError(userMessage);
      setStep('error');
      
      // Track failed swap
      await logTransactionEvent({
        eventType: 'swap_failed',
        chainKey: fromChain,
        tokenSymbol: typeof fromToken === 'string' ? fromToken : ((fromToken as any)?.symbol || 'UNKNOWN'),
        valueUSD: 0,
        status: 'failed',
        metadata: {
          fromToken: typeof fromToken === 'string' ? fromToken : (fromToken as any)?.symbol || 'unknown',
          toToken: typeof toToken === 'string' ? toToken : (toToken as any)?.symbol || 'unknown',
          fromAmount: amount,
          toChain,
          error: error.message,
        },
      });
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

  const handleMaxAmount = () => {
    const balance = getTokenBalance(fromToken, fromChain);
    if (!balance || parseFloat(balance) === 0) return;
    
    // For native tokens, reserve gas
    if (fromToken === 'native') {
      const balanceNum = parseFloat(balance);
      
      // ✅ SMART GAS RESERVE: Use percentage-based reserve for small balances
      // This ensures users can swap even with tiny amounts like 0.002812 ETH
      let gasReserve: number;
      
      if (balanceNum < 0.01) {
        // For very small balances (< 0.01 ETH), reserve 5% for gas
        gasReserve = balanceNum * 0.05;
      } else if (balanceNum < 0.1) {
        // For small balances (< 0.1 ETH), reserve 0.003 ETH
        gasReserve = 0.003;
      } else {
        // For larger balances, use fixed reserves by chain
        gasReserve = fromChain === 'ethereum' ? 0.005 : 
                     fromChain === 'bsc' ? 0.01 :
                     fromChain === 'polygon' ? 0.05 :
                     fromChain === 'avalanche' ? 0.1 :
                     0.01; // Default
      }
      
      const maxAmount = Math.max(0, balanceNum - gasReserve);
      
      // Ensure we don't set a too small amount (dust)
      if (maxAmount < 0.000001) {
        logger.warn('⚠️ [SwapModal] Balance too small after gas reserve');
        return;
      }
      
      setAmount(maxAmount.toFixed(6));
      logger.log(`💰 [SwapModal] MAX: ${balanceNum} - ${gasReserve} gas = ${maxAmount.toFixed(6)}`);
    } else {
      // For ERC20/SPL tokens, use full balance (no gas reserve needed)
      setAmount(parseFloat(balance).toFixed(6));
    }
  };

  const getExchangeRate = (): string => {
    if (!quote || !amount || parseFloat(amount) === 0) return '';
    
    const fromAmount = parseFloat(amount);
    const toAmount = parseFloat(formatAmount(
      quote.estimate?.toAmount || '0',
      toToken === 'native' 
        ? CHAINS[toChain]?.nativeCurrency?.decimals || 18
        : (toToken as LiFiToken)?.decimals || 18
    ));
    
    if (toAmount === 0) return '';
    
    const rate = toAmount / fromAmount;
    return `1 ${fromTokenDisplay.symbol} ≈ ${rate.toFixed(6)} ${toTokenDisplay.symbol}`;
  };

  const getTokenBalance = (token: LiFiToken | 'native' | null, chain: string): string => {
    if (!token) return '0';
    
    if (token === 'native') {
      // ✅ CRITICAL FIX: Native tokens are NOT stored in chainTokens!
      // They are stored separately in wallet store's `balance` field
      
      // First check chainTokens (in case it WAS added there)
      const chainTokens = getChainTokens(chain);
      const nativeToken = chainTokens.find(t => t.address === 'native');
      if (nativeToken?.balance && parseFloat(nativeToken.balance) > 0) {
        return nativeToken.balance;
      }
      
      // Main path: Use wallet store balance if on current chain
      if (chain === currentChain) {
        const { balance: walletBalance } = useWalletStore.getState();
        return walletBalance || '0';
      }
      
      // Different chain: can't show balance (not current)
      return '0';
    } else {
      // For ERC20/SPL tokens - these ARE in chainTokens
      const chainTokens = getChainTokens(chain);
      const tokenData = chainTokens.find(t => t.address === token.address);
      return tokenData?.balance || '0';
    }
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
            {/* Header */}
            <div className="pt-4 pb-2">
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
              >
                ← Back
              </button>
            </div>

            {/* Title Section - Blaze Style */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Repeat className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Swap</h2>
                  <p className="text-sm text-gray-600">
                    {isCrossChain ? 'Cross-chain swap with bridge' : 'Best rates, instant execution'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 pb-6">
              <div className="glass-card p-4 sm:p-6 space-y-6">
              {step === 'input' && (
                <div className="space-y-4 sm:space-y-6">
                  {/* From Token Section */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                      <span>From</span>
                      {fromToken && (
                        <span className="text-xs text-gray-500">
                          Balance: {parseFloat(getTokenBalance(fromToken, fromChain)).toFixed(6)} {fromTokenDisplay.symbol}
                        </span>
                      )}
                    </label>
                    
                    <div className="flex gap-2 sm:gap-3">
                      {/* Chain Selector */}
                      <div className="relative chain-dropdown-container">
                        <button
                          onClick={() => {
                            setShowFromChainDropdown(!showFromChainDropdown);
                            setShowToChainDropdown(false);
                          }}
                          className="px-3 sm:px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-2 min-w-[100px] sm:min-w-[120px]"
                        >
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {CHAINS[fromChain]?.shortName || fromChain}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${showFromChainDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showFromChainDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute z-20 w-48 sm:w-56 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-[300px] overflow-y-auto"
                          >
                            {Object.keys(CHAINS)
                              .filter(c => {
                                const chain = CHAINS[c];
                                // ✅ FIX: Include ALL supported chains (EVM + Solana)
                                // Exclude UTXO chains (Bitcoin, Litecoin, Dogecoin, Bitcoin Cash) as Li.Fi doesn't support them
                                // Exclude testnets
                                return !chain.isTestnet && 
                                       chain.chainType !== 'UTXO' &&
                                       isLiFiSupported(c);
                              })
                              .sort((a, b) => {
                                // Sort: Solana first, then EVM chains alphabetically
                                if (a === 'solana') return -1;
                                if (b === 'solana') return 1;
                                return CHAINS[a].name.localeCompare(CHAINS[b].name);
                              })
                              .map((chainKey) => {
                                const chain = CHAINS[chainKey];
                                return (
                                  <button
                                    key={chainKey}
                                    onClick={() => {
                                      setFromChain(chainKey);
                                      setShowFromChainDropdown(false);
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
                                      <span className="font-medium text-gray-900 text-sm">{chain.name}</span>
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
                        className="flex-1 px-3 sm:px-4 py-3 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl hover:from-orange-100 hover:to-yellow-100 transition-all flex items-center justify-between border-2 border-orange-200"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-orange-200 flex-shrink-0">
                            {fromTokenDisplay.logo && (fromTokenDisplay.logo.startsWith('http') || fromTokenDisplay.logo.startsWith('/') || fromTokenDisplay.logo.startsWith('data:') || fromTokenDisplay.logo.startsWith('blob:')) ? (
                              <img 
                                src={isIPFSUrl(fromTokenDisplay.logo) ? getIPFSGatewayUrl(fromTokenDisplay.logo) : fromTokenDisplay.logo} 
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
                              <span className="text-sm font-bold text-orange-700">{fromTokenDisplay.symbol[0]}</span>
                            )}
                          </div>
                          <div className="text-left min-w-0">
                            <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">{fromTokenDisplay.symbol}</div>
                            <div className="text-xs text-gray-500 truncate hidden sm:block">{fromTokenDisplay.name}</div>
                          </div>
                        </div>
                        <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      </button>
                    </div>

                    {/* Amount Input with MAX button */}
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-4 py-4 pr-20 text-xl sm:text-2xl font-bold text-gray-900 bg-gray-50 rounded-xl border-2 border-transparent focus:border-orange-500 focus:outline-none transition-colors"
                      />
                      <button
                        onClick={handleMaxAmount}
                        disabled={!fromToken || parseFloat(getTokenBalance(fromToken, fromChain)) === 0}
                        className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-xs sm:text-sm font-bold rounded-lg hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* Swap Direction Button */}
                  <div className="flex justify-center -my-2 relative z-10">
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 180 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const tempChain = fromChain;
                        const tempToken = fromToken;
                        setFromChain(toChain);
                        setToChain(tempChain);
                        setFromToken(toToken);
                        setToToken(tempToken);
                      }}
                      className="p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all border-2 border-orange-200"
                    >
                      <Repeat className="w-5 h-5 text-orange-600" />
                    </motion.button>
                  </div>

                  {/* To Token Section */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">To (estimated)</label>
                    <div className="flex gap-2 sm:gap-3">
                      {/* Chain Selector */}
                      <div className="relative chain-dropdown-container">
                        <button
                          onClick={() => {
                            setShowToChainDropdown(!showToChainDropdown);
                            setShowFromChainDropdown(false);
                          }}
                          className="px-3 sm:px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-2 min-w-[100px] sm:min-w-[120px]"
                        >
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {CHAINS[toChain]?.shortName || toChain}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${showToChainDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showToChainDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute z-20 w-48 sm:w-56 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-[300px] overflow-y-auto"
                          >
                            {Object.keys(CHAINS)
                              .filter(c => {
                                const chain = CHAINS[c];
                                // ✅ FIX: Include ALL supported chains (EVM + Solana)
                                // Exclude UTXO chains (Bitcoin, Litecoin, Dogecoin, Bitcoin Cash) as Li.Fi doesn't support them
                                // Exclude testnets
                                return !chain.isTestnet && 
                                       chain.chainType !== 'UTXO' &&
                                       isLiFiSupported(c);
                              })
                              .sort((a, b) => {
                                // Sort: Solana first, then EVM chains alphabetically
                                if (a === 'solana') return -1;
                                if (b === 'solana') return 1;
                                return CHAINS[a].name.localeCompare(CHAINS[b].name);
                              })
                              .map((chainKey) => {
                                const chain = CHAINS[chainKey];
                                return (
                                  <button
                                    key={chainKey}
                                    onClick={() => {
                                      setToChain(chainKey);
                                      setShowToChainDropdown(false);
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
                                      <span className="font-medium text-gray-900 text-sm">{chain.name}</span>
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
                        className="flex-1 px-3 sm:px-4 py-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl hover:from-emerald-100 hover:to-teal-100 transition-all flex items-center justify-between border-2 border-emerald-200"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-emerald-200 flex-shrink-0">
                            {toTokenDisplay.logo && (toTokenDisplay.logo.startsWith('http') || toTokenDisplay.logo.startsWith('/') || toTokenDisplay.logo.startsWith('data:') || toTokenDisplay.logo.startsWith('blob:')) ? (
                              <img 
                                src={isIPFSUrl(toTokenDisplay.logo) ? getIPFSGatewayUrl(toTokenDisplay.logo) : toTokenDisplay.logo} 
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
                              <span className="text-sm font-bold text-emerald-700">{toTokenDisplay.symbol[0]}</span>
                            )}
                          </div>
                          <div className="text-left min-w-0">
                            <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">{toTokenDisplay.symbol}</div>
                            <div className="text-xs text-gray-500 truncate hidden sm:block">{toTokenDisplay.name}</div>
                          </div>
                        </div>
                        <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      </button>
                    </div>

                    {/* Quote Display - Enhanced */}
                    {isLoadingQuote && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="px-4 py-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl flex items-center gap-2 border-2 border-orange-200"
                      >
                        <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                        <span className="text-sm text-gray-700 font-medium">Finding best rate...</span>
                      </motion.div>
                    )}

                    {quote && !isLoadingQuote && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="px-4 py-3 bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-50 rounded-xl border-2 border-orange-200 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">You receive</span>
                          {isCrossChain && (
                            <div className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                              <Zap className="w-3 h-3" />
                              <span>Bridge</span>
                            </div>
                          )}
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-gray-900">
                          {formatAmount(
                            quote.estimate?.toAmount || '0',
                            toToken === 'native' 
                              ? CHAINS[toChain]?.nativeCurrency?.decimals || 18
                              : (toToken as LiFiToken)?.decimals || 18
                          )} {toTokenDisplay.symbol}
                        </div>
                        {quote.estimate?.toAmountUSD && parseFloat(quote.estimate.toAmountUSD) > 0 && (
                          <div className="text-sm text-gray-600">
                            ≈ ${parseFloat(quote.estimate.toAmountUSD).toFixed(2)} USD
                          </div>
                        )}
                        <div className="pt-2 mt-2 border-t border-orange-200 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Rate</span>
                            <span className="text-gray-900 font-medium">{getExchangeRate()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">DEX</span>
                            <span className="text-orange-600 font-semibold capitalize">{quote.tool || 'Auto'}</span>
                          </div>
                          {quote.estimate?.executionDuration && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">Time</span>
                              <span className="text-gray-900 font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                ~{Math.ceil(quote.estimate.executionDuration / 60)}min
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {quoteError && !isLoadingQuote && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="px-4 py-3 bg-red-50 rounded-xl flex items-center gap-2 border-2 border-red-200"
                      >
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <span className="text-sm text-red-600">{quoteError}</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Slippage Settings - Top Priority UI */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                        Slippage Tolerance
                        <Info className="w-3 h-3 text-gray-400" />
                      </label>
                      <span className="text-sm font-bold text-orange-600">{slippage}%</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[0.1, 0.5, 1.0, 3.0].map((val) => (
                        <button
                          key={val}
                          onClick={() => setSlippage(val)}
                          className={`px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            slippage === val
                              ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Swap Button - Blaze Orange Theme */}
                  <button
                    onClick={() => {
                      if (quote) {
                        setStep('review');
                      }
                    }}
                    disabled={!quote || isLoadingQuote || !amount || parseFloat(amount) <= 0}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl text-base sm:text-lg"
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
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 space-y-3 border-2 border-gray-200">
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
                            : (toToken as LiFiToken)?.decimals || 18
                        )} {toTokenDisplay.symbol}
                      </span>
                    </div>
                    {isCrossChain && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <span className="text-sm text-gray-600">Route</span>
                        <span className="text-sm font-semibold text-orange-600 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {CHAINS[fromChain]?.shortName} → {CHAINS[toChain]?.shortName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Rate</span>
                      <span className="text-sm font-semibold text-gray-900">{getExchangeRate()}</span>
                    </div>
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
                      className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all shadow-lg hover:shadow-xl"
                    >
                      Confirm Swap
                    </button>
                  </div>
                </div>
              )}

              {step === 'executing' && (
                <div className="space-y-6 text-center py-6">
                  <div className="flex justify-center">
                    <div className="relative">
                      <Loader2 className="w-16 h-16 animate-spin text-orange-500" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full opacity-20 animate-ping" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Processing Swap</h3>
                    <p className="text-sm text-gray-600">
                      {isCrossChain 
                        ? `Step ${executionStep} of ${totalSteps}: Bridging to ${CHAINS[toChain]?.name}...`
                        : 'Executing swap transaction...'
                      }
                    </p>
                    {totalSteps > 1 && (
                      <div className="mt-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(executionStep / totalSteps) * 100}%` }}
                            className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2 rounded-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 'success' && (
                <div className="space-y-6 text-center py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="flex justify-center"
                  >
                    <div className="w-16 h-16 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                  </motion.div>
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
                        className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-semibold"
                      >
                        View on Explorer <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      setStep('input');
                      setAmount('');
                      setQuote(null);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all"
                  >
                    Done
                  </button>
                </div>
              )}

              {step === 'error' && (
                <div className="space-y-6 text-center py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="flex justify-center"
                  >
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                  </motion.div>
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
                      className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition-all"
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
      {/* FROM Token Modal - Only show tokens with balance */}
      <TokenSearchModal
        isOpen={showFromTokenModal}
        onClose={() => setShowFromTokenModal(false)}
        chainKey={fromChain}
        selectedToken={fromToken === 'native' ? 'native' : (fromToken as LiFiToken)?.address}
        onSelectToken={(token) => {
          setFromToken(token);
          setShowFromTokenModal(false);
        }}
        excludeTokens={toToken === 'native' ? [] : toToken ? [(toToken as LiFiToken).address] : []}
        walletTokens={(() => {
          const walletTokensList: Array<{ 
            address: string; 
            balance: string; 
            symbol?: string; 
            name?: string; 
            logo?: string; 
            decimals?: number 
          }> = [];
          
          // Get actual balance for native token
          const nativeBalance = getTokenBalance('native', fromChain);
          if (parseFloat(nativeBalance) > 0) {
            walletTokensList.push({ 
              address: 'native', 
              balance: nativeBalance,
              symbol: CHAINS[fromChain]?.nativeCurrency?.symbol,
              name: CHAINS[fromChain]?.nativeCurrency?.name,
              logo: CHAINS[fromChain]?.logoUrl,
              decimals: CHAINS[fromChain]?.nativeCurrency?.decimals
            });
          }
          
          // Get ERC20/SPL tokens from wallet
          const chainTokens = getChainTokens(fromChain);
          const tokensToUse = chainTokens.length > 0 
            ? chainTokens 
            : (fromChain === currentChain ? tokens : []);
          
          tokensToUse.forEach(t => {
            if (t.address && t.address !== 'native' && t.balance && parseFloat(t.balance || '0') > 0) {
              walletTokensList.push({
                address: t.address,
                balance: t.balance,
                symbol: t.symbol,
                name: t.name,
                logo: t.logo,
                decimals: t.decimals
              });
            }
          });
          
          return walletTokensList;
        })()}
        onlyShowTokensWithBalance={true}
      />

      {/* TO Token Modal - Show all popular tokens (MetaMask style) */}
      <TokenSearchModal
        isOpen={showToTokenModal}
        onClose={() => setShowToTokenModal(false)}
        chainKey={toChain}
        selectedToken={toToken === 'native' ? 'native' : (toToken as LiFiToken)?.address}
        onSelectToken={(token) => {
          setToToken(token);
          setShowToTokenModal(false);
        }}
        excludeTokens={fromToken === 'native' ? [] : fromToken ? [(fromToken as LiFiToken).address] : []}
        walletTokens={[]}
        onlyShowTokensWithBalance={false}
      />

      {/* 🔐 2FA Verification Modal */}
      {userId && (
        <SensitiveAction2FAModal
          isOpen={show2FAModal}
          onClose={() => setShow2FAModal(false)}
          onSuccess={executeSwap}
          userId={userId}
          actionName={`Swap ${amount} ${fromToken === 'native' ? CHAINS[fromChain]?.nativeCurrency?.symbol : (fromToken as any)?.symbol || ''} → ${toToken === 'native' ? CHAINS[toChain]?.nativeCurrency?.symbol : (toToken as any)?.symbol || ''}`}
          actionType="swap"
          amountUSD={pendingSwapData?.swapValueUSD}
        />
      )}
    </AnimatePresence>
  );
}
