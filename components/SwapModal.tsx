'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowDown, 
  Flame, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  RefreshCw, 
  ChevronDown,
  Check,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { CHAINS } from '@/lib/chains';
import { LiFiService, LiFiQuote, LiFiToken } from '@/lib/lifi-service';
import { JupiterService, JupiterQuote } from '@/lib/jupiter-service';
import { getLiFiChainId } from '@/lib/lifi-chain-ids';
import { MultiChainService } from '@/lib/multi-chain-service';
import { PriceService } from '@/lib/price-service';
import { ethers } from 'ethers';
import { logger } from '@/lib/logger';
import { useCurrency } from '@/contexts/CurrencyContext';
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

interface AvailableToken {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  logo?: string;
  isNative: boolean;
}

export default function SwapModal({ isOpen, onClose, prefillData }: SwapModalProps) {
  const { wallet, currentChain, balance, getCurrentAddress, getChainTokens, mnemonic } = useWalletStore();
  const { formatUSDSync } = useCurrency();
  
  // Chain states
  const [fromChain, setFromChain] = useState(currentChain);
  const [toChain, setToChain] = useState(currentChain);
  const [showFromChainDropdown, setShowFromChainDropdown] = useState(false);
  const [showToChainDropdown, setShowToChainDropdown] = useState(false);
  
  // Token states
  const [fromToken, setFromToken] = useState<string>('native');
  const [toToken, setToToken] = useState<string>('');
  const [showFromTokenDropdown, setShowFromTokenDropdown] = useState(false);
  
  // Available tokens (only tokens user owns)
  const [availableFromTokens, setAvailableFromTokens] = useState<AvailableToken[]>([]);
  const [isLoadingFromTokens, setIsLoadingFromTokens] = useState(false);
  const [fromChainBalance, setFromChainBalance] = useState('0');
  
  // Amount states
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  
  // Quote states
  const [quote, setQuote] = useState<LiFiQuote | JupiterQuote | null>(null);
  const [isJupiterQuote, setIsJupiterQuote] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  
  // Execution states
  const [step, setStep] = useState<'input' | 'confirm' | 'executing' | 'success'>('input');
  const [isSwapping, setIsSwapping] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [stepStatus, setStepStatus] = useState('');
  const [txHash, setTxHash] = useState('');
  
  // Error states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Polling ref
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fromChainConfig = CHAINS[fromChain];
  const toChainConfig = CHAINS[toChain];

  // Token search modal states
  const [showToTokenSearch, setShowToTokenSearch] = useState(false);
  const [selectedToToken, setSelectedToToken] = useState<LiFiToken | 'native' | null>(null);

  useBlockBodyScroll(isOpen);

  // Fetch available tokens for fromChain (only tokens user owns)
  const fetchFromTokens = async (chain: string) => {
    setIsLoadingFromTokens(true);
    try {
      const chainConfig = CHAINS[chain];
      const chainService = MultiChainService.getInstance(chain);
      const priceService = new PriceService();
      
      // Get address for the chain
      let displayAddress: string;
      if (chain === 'solana') {
        const { solanaAddress } = useWalletStore.getState();
        displayAddress = solanaAddress || '';
      } else if (chain === 'bitcoin' || chain === 'litecoin' || chain === 'dogecoin' || chain === 'bitcoincash') {
        // Bitcoin forks don't support token swaps via Li.Fi
        setIsLoadingFromTokens(false);
        return;
      } else {
        // EVM chains
        const { address } = useWalletStore.getState();
        displayAddress = address || '';
      }

      if (!displayAddress) {
        logger.error('❌ No wallet address available for', chain);
        setIsLoadingFromTokens(false);
        return;
      }

      // Fetch native balance
      const nativeBalance = await chainService.getBalance(displayAddress);
      setFromChainBalance(nativeBalance);
      
      const nativeSymbol = chainConfig.nativeCurrency.symbol;
      const prices = await priceService.getMultiplePrices([nativeSymbol]);
      const nativePrice = prices[nativeSymbol] || 0;
      
      const tokens: AvailableToken[] = [
        {
          address: 'native',
          symbol: nativeSymbol,
          name: chainConfig.nativeCurrency.name,
          balance: nativeBalance,
          decimals: chainConfig.nativeCurrency.decimals,
          logo: chainConfig.logoUrl,
          isNative: true,
        }
      ];

      // Fetch tokens for Solana
      if (chain === 'solana') {
        const solanaService = chainService as any;
        if (solanaService.getSPLTokenBalances) {
          const splTokens = await solanaService.getSPLTokenBalances(displayAddress);
          const splSymbols = splTokens.map((t: any) => t.symbol);
          const splPrices = await priceService.getMultiplePrices(splSymbols);
          
          splTokens.forEach((token: any) => {
            const balance = parseFloat(token.balance || '0');
            if (balance > 0) {
              tokens.push({
                address: token.address,
                symbol: token.symbol,
                name: token.name,
                balance: token.balance,
                decimals: token.decimals,
                logo: token.logo,
                isNative: false,
              });
            }
          });
        }
      } 
      // Fetch ERC20 tokens for EVM chains from wallet store
      else {
        const chainTokens = getChainTokens(chain);
        logger.log(`🪙 [SwapModal] Found ${chainTokens.length} cached tokens for ${chain}`);
        
        for (const token of chainTokens) {
          // Skip native currency (already added)
          if (!token.address) continue;
          
          const balance = parseFloat(token.balance || '0');
          if (balance > 0) {
            tokens.push({
              address: token.address,
              symbol: token.symbol,
              name: token.name,
              balance: token.balance || '0',
              decimals: token.decimals,
              logo: token.logo,
              isNative: false,
            });
          }
        }
      }

      setAvailableFromTokens(tokens);
      logger.log(`✅ Loaded ${tokens.length} available tokens for ${chain}:`, tokens);
    } catch (error) {
      logger.error('❌ Failed to fetch from tokens:', error);
      setAvailableFromTokens([]);
    } finally {
      setIsLoadingFromTokens(false);
    }
  };

  // Initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      setFromChain(currentChain);
      setToChain(currentChain);
      setFromToken('native');
      setToToken('');
      setSelectedToToken(null);
      setFromAmount('');
      setToAmount('');
      setQuote(null);
      setError('');
      setSuccess(false);
      setStep('input');
      setCurrentStepIndex(0);
      setTotalSteps(0);
      setStepStatus('');
      setTxHash('');
      
      // Fetch available tokens for fromChain
      fetchFromTokens(currentChain);
    } else {
      // Cleanup polling on close
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isOpen, currentChain]);

  // Fetch tokens when fromChain changes
  useEffect(() => {
    if (isOpen && fromChain) {
      fetchFromTokens(fromChain);
      // Reset fromToken when chain changes
      setFromToken('native');
    }
  }, [fromChain, isOpen]);

  // Reset toToken when toChain changes
  useEffect(() => {
    if (isOpen && toChain) {
      setToToken('');
      setSelectedToToken(null);
    }
  }, [toChain, isOpen]);

  // AI Assistant pre-fill
  useEffect(() => {
    if (isOpen && prefillData && availableFromTokens.length > 0) {
      logger.log('🤖 [SwapModal] Applying AI pre-fill data:', prefillData);
      
      if (prefillData.fromToken) {
        const tokenSymbol = prefillData.fromToken.toUpperCase();
        if (tokenSymbol === fromChainConfig?.nativeCurrency.symbol.toUpperCase()) {
          setFromToken('native');
        } else {
          // Use availableFromTokens (tokens user owns)
          const matchingToken = availableFromTokens.find(
            token => token.symbol.toUpperCase() === tokenSymbol
          );
          if (matchingToken) {
            setFromToken(matchingToken.address);
          }
        }
      }
      
      if (prefillData.toToken) {
        const tokenSymbol = prefillData.toToken.toUpperCase();
        if (tokenSymbol === toChainConfig?.nativeCurrency.symbol.toUpperCase()) {
          setToToken('native');
          setSelectedToToken('native');
        } else {
          // Note: We can't match tokens here without fetching from Li.Fi
          // The user will need to select manually or we fetch tokens first
          logger.warn('⚠️ [SwapModal] Cannot pre-fill toToken without fetching tokens first');
          }
        }
      
      if (prefillData.amount) {
        if (prefillData.amount === 'max' || prefillData.amount === 'all') {
          const balance = getTokenBalance(fromToken);
          setFromAmount(balance);
        } else {
          setFromAmount(prefillData.amount);
        }
      }
    }
  }, [isOpen, prefillData, fromChainConfig, toChainConfig, availableFromTokens, fromToken]);

  // Fetch quote when inputs change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fromAmount && parseFloat(fromAmount) > 0 && fromToken && toToken && wallet) {
        fetchQuote();
      } else {
        setToAmount('');
        setQuote(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fromAmount, fromToken, toToken, fromChain, toChain]);

  const fetchQuote = async () => {
    if (!fromAmount || !fromToken || !toToken || !wallet) return;

    setIsLoadingQuote(true);
    setError('');
    setQuote(null);
    setIsJupiterQuote(false);

    try {
      // ✅ CRITICAL FIX: Use Li.Fi chain IDs (Solana is string "1151111081099710", not 101)
      const fromChainId = getLiFiChainId(fromChain);
      const toChainId = getLiFiChainId(toChain);
      const fromAddress = getCurrentAddress() || wallet.address;
      
      // ✅ Li.Fi supports both cross-chain AND on-chain swaps (including Solana)
      // According to docs: https://docs.li.fi/widget/overview
      // "Cross-chain and on-chain swap and bridging UI toolkit"
      // Li.Fi uses Jupiter under the hood for Solana swaps
      // We use Li.Fi for all swaps, including Solana same-chain
      const isSolanaSameChain = fromChain === 'solana' && toChain === 'solana';
      
      // Use Li.Fi for all swaps (it handles Solana internally via Jupiter)
      if (false && isSolanaSameChain) {
        // Use Jupiter for Solana same-chain swaps
        logger.log('🪐 Using Jupiter for Solana same-chain swap');
        
        // Convert amount to lamports
        let amountInLamports: string;
        if (fromToken === 'native') {
          const decimals = 9; // SOL has 9 decimals
          amountInLamports = (parseFloat(fromAmount) * Math.pow(10, decimals)).toString();
        } else {
          const token = availableFromTokens.find(t => t.address.toLowerCase() === fromToken.toLowerCase());
          const decimals = token?.decimals || 9;
          amountInLamports = (parseFloat(fromAmount) * Math.pow(10, decimals)).toString();
        }

        // Normalize token addresses
        const inputMint = fromToken === 'native' 
          ? JupiterService.getNativeSOLAddress() 
        : fromToken;
        const outputMint = toToken === 'native'
          ? JupiterService.getNativeSOLAddress()
          : toToken;

        const response = await fetch(
          `/api/jupiter/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInLamports}&slippageBps=50`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch quote from Jupiter');
        }

        const data = await response.json();
        if (data.success && data.quote) {
          const jupiterQuote = data.quote as JupiterQuote;
          setQuote(jupiterQuote);
          setIsJupiterQuote(true);
          
          // Format output amount (Jupiter returns in smallest unit)
          const outputMintAddress = toToken === 'native' 
            ? JupiterService.getNativeSOLAddress() 
            : toToken;
          const toTokenInfo = availableFromTokens.find(t => 
            t.address.toLowerCase() === outputMintAddress.toLowerCase()
          ) || (toToken === 'native' ? { decimals: 9 } : { decimals: 9 });
          const decimals = toTokenInfo.decimals || 9;
          const formatted = (parseFloat(jupiterQuote.outAmount) / Math.pow(10, decimals)).toString();
          setToAmount(formatted);
          
          logger.log('✅ Jupiter quote received:', {
            inAmount: jupiterQuote.inAmount,
            outAmount: jupiterQuote.outAmount,
            priceImpact: jupiterQuote.priceImpactPct,
          });
        } else {
          throw new Error('No quote available from Jupiter');
        }
      } else {
        // Use Li.Fi for cross-chain swaps or EVM chains
        logger.log('🌉 Using Li.Fi for cross-chain or EVM swap');
        
        // Convert amount to smallest unit - handle Solana (9 decimals) vs EVM (18 decimals)
        let amountInWei: string;
        if (fromToken === 'native') {
          const decimals = fromChainConfig.nativeCurrency.decimals || 18;
          if (fromChain === 'solana') {
            amountInWei = (parseFloat(fromAmount) * Math.pow(10, decimals)).toString();
          } else {
            amountInWei = ethers.parseEther(fromAmount).toString();
          }
        } else {
          const token = availableFromTokens.find(t => t.address.toLowerCase() === fromToken.toLowerCase());
          const decimals = token?.decimals || 18;
          if (fromChain === 'solana') {
            amountInWei = (parseFloat(fromAmount) * Math.pow(10, decimals)).toString();
          } else {
            amountInWei = ethers.parseUnits(fromAmount, decimals).toString();
          }
        }

        // ✅ CRITICAL: Convert 'native' to actual token address BEFORE API call
        // Li.Fi requires actual addresses, not 'native' string
        if (!fromToken || !toToken) {
          throw new Error('From token and to token are required');
        }
        
        const fromTokenAddress = fromToken === 'native' 
          ? LiFiService.getNativeTokenAddress(fromChainId)
          : fromToken;
        const toTokenAddress = toToken === 'native' || !toToken
          ? LiFiService.getNativeTokenAddress(toChainId)
          : toToken;
        
        // Validate addresses are not undefined
        if (!fromTokenAddress || !toTokenAddress) {
          throw new Error('Failed to convert token addresses. Please try again.');
        }
        
        // ✅ CRITICAL: Convert chain IDs to strings for URL (Li.Fi accepts both)
        const response = await fetch(
          `/api/lifi/quote?fromChain=${fromChainId.toString()}&toChain=${toChainId.toString()}&fromToken=${fromTokenAddress}&toToken=${toTokenAddress}&fromAmount=${amountInWei}&fromAddress=${fromAddress}&slippage=0.03&order=RECOMMENDED`
        );

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.error || 'Failed to fetch quote';
          const errorDetails = errorData.details || '';
          const errorHint = errorData.hint || '';
          
          let fullErrorMessage = errorMessage;
          if (errorDetails) {
            fullErrorMessage += `: ${errorDetails}`;
          }
          if (errorHint) {
            fullErrorMessage += ` ${errorHint}`;
          }
          
          throw new Error(fullErrorMessage);
        }

        const data = await response.json();
        if (data.success && data.quote) {
          const lifiQuote = data.quote as LiFiQuote;
          setQuote(lifiQuote);
          setIsJupiterQuote(false);
        
          // Format output amount
          const toTokenDecimals = lifiQuote.action.toToken.decimals || 18;
          const formatted = ethers.formatUnits(lifiQuote.estimate.toAmount, toTokenDecimals);
        setToAmount(formatted);
        
          logger.log('✅ Li.Fi quote received:', {
            tool: lifiQuote.tool,
            steps: lifiQuote.steps.length,
            toAmount: formatted,
          });
        } else {
          throw new Error('No quote available');
        }
      }
    } catch (err: any) {
      logger.error('❌ Quote error:', err);
      setError(err.message || 'Error fetching quote');
      setQuote(null);
      setToAmount('');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleTokenApproval = async (
    tokenAddress: string,
    amount: string,
    spenderAddress: string
  ): Promise<void> => {
    if (!wallet) throw new Error('Wallet not connected');

    const provider = new ethers.JsonRpcProvider(fromChainConfig.rpcUrl);
    const signer = wallet.connect(provider);

    // ERC20 ABI for approve
    const erc20ABI = [
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ];

    const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, signer);

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(
      wallet.address,
      spenderAddress
    );

    // Get token decimals
    const decimals = await tokenContract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    // If allowance is insufficient, approve
    if (currentAllowance < amountWei) {
      logger.log('🔐 Approving token...');
      setStepStatus('Approving token...');
      const approveTx = await tokenContract.approve(spenderAddress, amountWei);
      await approveTx.wait();
      logger.log('✅ Token approved');
    } else {
      logger.log('✅ Token already approved');
    }
  };

  const executeSwap = async () => {
    if (!wallet || !quote || !fromAmount) {
      setError('Wallet, quote or amount missing');
      return;
    }

    setIsSwapping(true);
    setError('');
    setStep('executing');
    setStepStatus('Preparing swap...');

    try {
      // ✅ CRITICAL: Handle Jupiter swaps (Solana same-chain) differently
      if (isJupiterQuote) {
        const jupiterQuote = quote as JupiterQuote;
        const { solanaAddress } = useWalletStore.getState();
        
        if (!solanaAddress) {
          throw new Error('Solana address not found');
        }

        setStepStatus('Getting swap transaction from Jupiter...');
        
        // Get swap transaction from Jupiter
        const response = await fetch('/api/jupiter/swap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quote: jupiterQuote,
            userPublicKey: solanaAddress,
            wrapUnwrapSOL: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to get swap transaction from Jupiter');
        }

        const data = await response.json();
        if (!data.success || !data.swapTransaction) {
          throw new Error('Failed to get swap transaction from Jupiter');
        }

        const { swapTransaction: swapTxBase64, lastValidBlockHeight } = data.swapTransaction;

        setStepStatus('Signing transaction...');

        // Import Solana libraries dynamically
        const solanaWeb3 = await import('@solana/web3.js');
        const { SolanaService } = await import('@/lib/solana-service');
        
        // Deserialize transaction
        const swapTransactionBuf = Buffer.from(swapTxBase64, 'base64');
        // Use 'any' type for transaction since we're using dynamic imports
        // The actual types are Transaction | VersionedTransaction from @solana/web3.js
        let transaction: any;
        
        try {
          // Try versioned transaction first (newer format)
          transaction = solanaWeb3.VersionedTransaction.deserialize(swapTransactionBuf);
        } catch {
          // Fallback to legacy transaction
          transaction = solanaWeb3.Transaction.from(swapTransactionBuf);
        }

        // Get Solana connection
        const solanaService = new SolanaService(fromChainConfig.rpcUrl);
        const connection = solanaService['connection'];

        // Sign transaction with Solana keypair (not ethers wallet!)
        setStepStatus('Signing transaction with wallet...');
        if (!mnemonic) {
          throw new Error('Mnemonic required for Solana transaction signing');
        }
        
        // Derive Solana keypair from mnemonic
        const { derivePath } = await import('ed25519-hd-key');
        const bip39 = await import('bip39');
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
        const { Keypair } = solanaWeb3;
        const keypair = Keypair.fromSeed(derivedSeed);
        
        // Sign the transaction
        if ('sign' in transaction) {
          // VersionedTransaction
          transaction.sign([keypair]);
        } else {
          // Legacy Transaction
          transaction.sign(keypair);
        }
        
        setStepStatus('Sending transaction to Solana...');
        const signature = await connection.sendRawTransaction(
          transaction.serialize(),
          {
            skipPreflight: false,
            maxRetries: 3,
          }
        );

        setTxHash(signature);
        setStepStatus('Waiting for confirmation...');

        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');
        
        logger.log('✅ Jupiter swap completed:', signature);

        setSuccess(true);
        setStep('success');
        setStepStatus('Swap completed!');
        
        // Reset after 3 seconds
        setTimeout(() => {
          setFromAmount('');
          setToAmount('');
          setQuote(null);
          setSuccess(false);
          setStep('input');
          onClose();
        }, 3000);
      } else {
        // Li.Fi swap (cross-chain or EVM)
        const lifiQuote = quote as LiFiQuote;
        setCurrentStepIndex(0);
        setTotalSteps(lifiQuote.steps.length);

        // Execute each step sequentially
        for (let i = 0; i < lifiQuote.steps.length; i++) {
          setCurrentStepIndex(i + 1);
          setStepStatus(`Executing step ${i + 1} of ${lifiQuote.steps.length}...`);

          // Get transaction data for this step
          const response = await fetch('/api/lifi/execute', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              route: lifiQuote,
              stepIndex: i,
              userAddress: wallet.address,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get transaction data');
          }

          const data = await response.json();
          if (!data.success || !data.transaction) {
            throw new Error('Failed to get transaction data');
          }

          const { transactionRequest } = data.transaction;

          // Check if approval needed
          if (lifiQuote.steps[i].estimate.approvalAddress) {
            setStepStatus('Approving token...');
            const tokenAddress = lifiQuote.steps[i].action.fromToken.address;
            const amount = lifiQuote.steps[i].action.fromAmount;
            await handleTokenApproval(
              tokenAddress,
              ethers.formatUnits(amount, lifiQuote.steps[i].action.fromToken.decimals),
              lifiQuote.steps[i].estimate.approvalAddress
            );
        }

          // Execute transaction
          const chainConfig = i === 0 ? fromChainConfig : toChainConfig;
          const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
        const signer = wallet.connect(provider);

          setStepStatus('Sending transaction...');
        const tx = await signer.sendTransaction({
            to: transactionRequest.to,
            data: transactionRequest.data,
            value: transactionRequest.value || '0',
            gasLimit: transactionRequest.gasLimit || '300000',
            gasPrice: transactionRequest.gasPrice || undefined,
          });

          setStepStatus('Waiting for confirmation...');
          const receipt = await tx.wait();
          setTxHash(tx.hash);

          logger.log(`✅ Step ${i + 1} completed:`, tx.hash);

          // If cross-chain and last step, start status polling
          if (fromChain !== toChain && i === lifiQuote.steps.length - 1) {
            setStepStatus('Bridge transfer in progress...');
            pollTransactionStatus(tx.hash, lifiQuote);
          }
        }

        // If same-chain, we're done
        if (fromChain === toChain) {
      setSuccess(true);
          setStep('success');
          setStepStatus('Swap completed!');
      
          // Reset after 3 seconds
      setTimeout(() => {
        setFromAmount('');
        setToAmount('');
        setQuote(null);
        setSuccess(false);
            setStep('input');
        onClose();
          }, 3000);
        }
      }

    } catch (err: any) {
      logger.error('❌ Swap execution error:', err);
      setError(err.message || 'Swap failed');
      setStep('input');
    } finally {
      setIsSwapping(false);
    }
  };

  const pollTransactionStatus = (txHash: string, route: LiFiQuote) => {
    // Poll every 5 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/lifi/status?txHash=${txHash}&bridge=${route.tool}&fromChain=${route.action.fromChainId}&toChain=${route.action.toChainId}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.status) {
            const status = data.status.status;
            
            if (status === 'DONE') {
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              setSuccess(true);
              setStep('success');
              setStepStatus('Swap completed!');
              
              setTimeout(() => {
                setFromAmount('');
                setToAmount('');
                setQuote(null);
                setSuccess(false);
                setStep('input');
                onClose();
              }, 3000);
            } else if (status === 'FAILED') {
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              setError('Swap failed during bridge transfer');
              setStep('input');
            } else {
              setStepStatus(`Status: ${status.toLowerCase()}...`);
            }
          }
        }
      } catch (error) {
        logger.error('Error polling status:', error);
      }
    }, 5000);

    // Clear after 10 minutes
    setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }, 10 * 60 * 1000);
  };

  const getTokenSymbol = (address: string, chain: string, isFromToken: boolean = false): string => {
    if (address === 'native' || address === LiFiService.getNativeTokenAddress(CHAINS[chain]?.id || 1)) {
      return CHAINS[chain]?.nativeCurrency.symbol || 'Token';
    }
    
    if (isFromToken) {
      // For fromToken, use availableFromTokens (tokens user owns)
      const token = availableFromTokens.find(t => t.address.toLowerCase() === address.toLowerCase());
    return token?.symbol || 'Token';
    } else {
      // For toToken, use selectedToToken
      if (selectedToToken && selectedToToken !== 'native') {
        if (selectedToToken.address.toLowerCase() === address.toLowerCase()) {
          return selectedToToken.symbol;
        }
      }
      return 'Token';
    }
  };

  const getTokenName = (address: string, chain: string, isFromToken: boolean = false): string => {
    if (address === 'native' || address === LiFiService.getNativeTokenAddress(CHAINS[chain]?.id || 1)) {
      return CHAINS[chain]?.nativeCurrency.name || 'Token';
    }
    
    if (isFromToken) {
      // For fromToken, use availableFromTokens
      const token = availableFromTokens.find(t => t.address.toLowerCase() === address.toLowerCase());
      return token?.name || 'Token';
    } else {
      // For toToken, use selectedToToken
      if (selectedToToken && selectedToToken !== 'native') {
        if (selectedToToken.address.toLowerCase() === address.toLowerCase()) {
          return selectedToToken.name;
        }
      }
      return 'Token';
    }
  };

  const getTokenBalance = (address: string): string => {
    if (address === 'native') return fromChainBalance;
    const token = availableFromTokens.find(t => t.address.toLowerCase() === address.toLowerCase());
    return token?.balance || '0';
  };

  const handleMaxAmount = () => {
    const balance = getTokenBalance(fromToken);
    if (fromToken === 'native') {
      // Reserve a small amount for gas
      const max = Math.max(0, parseFloat(balance || '0') - 0.001);
      setFromAmount(max.toFixed(6));
    } else {
      // For tokens, use full balance
      setFromAmount(balance);
    }
  };

  const canSwap = (): boolean => {
    return !!quote && 
           !!fromAmount && 
           parseFloat(fromAmount) > 0 && 
           !!toToken &&
           !isLoadingQuote &&
           !isSwapping;
  };

  // Handle token selection from TokenSearchModal
  const handleToTokenSelect = (token: LiFiToken | 'native') => {
    setSelectedToToken(token);
    if (token === 'native') {
      setToToken('native');
    } else {
      setToToken(token.address);
    }
    setShowToTokenSearch(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Swap</h2>
                <p className="text-sm text-gray-600">
                  Exchange tokens at the best rates
                </p>
              </div>
            </div>
          </div>

            <div className="space-y-6 pb-6">
              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-700">{error}</p>
                </motion.div>
              )}

          {/* Success Message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-4 bg-emerald-50 border border-emerald-200 flex items-center gap-3"
            >
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-700">Swap successful!</p>
            </motion.div>
          )}

              {/* Input Step */}
              {step === 'input' && (
                <>
                  <div className="glass-card p-6 space-y-6">
                    {/* From Chain */}
                    <div>
                      <label className="text-sm font-medium text-gray-900 mb-2 block">
                        From network
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => {
                            setShowFromChainDropdown(!showFromChainDropdown);
                            setShowToChainDropdown(false);
                          }}
                          className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            {fromChainConfig.logoUrl ? (
                              <img 
                                src={fromChainConfig.logoUrl} 
                                alt={fromChainConfig.name}
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <span className="text-xl">{fromChainConfig.icon}</span>
                            )}
                            <span>{fromChainConfig.name}</span>
                          </div>
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        </button>
                        
                        {showFromChainDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
                          >
                            {Object.entries(CHAINS)
                              .filter(([key, chain]) => !chain.isTestnet)
                              .map(([key, chain]) => (
                                <button
                                  key={key}
                                  onClick={() => {
                                    setFromChain(key);
                                    setShowFromChainDropdown(false);
                                    // Reset tokens when chain changes
                                    setFromToken('native');
                                  }}
                                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                                    fromChain === key ? 'bg-orange-50' : ''
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
                                  {fromChain === key && (
                                    <Check className="w-5 h-5 text-orange-500" />
                                  )}
                                </button>
                              ))}
                          </motion.div>
                        )}
                      </div>
                    </div>

          {/* From Token */}
                    <div>
                      <label className="text-sm font-medium text-gray-900 mb-2 block">
                        From token
                      </label>
                      {isLoadingFromTokens ? (
                        <div className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                          <span className="ml-2 text-gray-600">Loading tokens...</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <button
                            onClick={() => {
                              setShowFromTokenDropdown(!showFromTokenDropdown);
                              setShowToTokenSearch(false);
                            }}
                            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-semibold">
                                {getTokenSymbol(fromToken, fromChain, true)}
                              </span>
                              <span className="text-sm text-gray-500">
                                {parseFloat(getTokenBalance(fromToken)).toFixed(6)}
                              </span>
                            </div>
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          </button>
                          
                          {showFromTokenDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
                            >
                              {availableFromTokens.map(token => (
                                <button
                                  key={token.address}
                                  onClick={() => {
                                    setFromToken(token.address);
                                    setShowFromTokenDropdown(false);
                                  }}
                                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                                    fromToken === token.address ? 'bg-orange-50' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="font-medium text-gray-900">{token.symbol}</span>
                                    <span className="text-sm text-gray-500 truncate">
                                      {parseFloat(token.balance).toFixed(6)}
                                    </span>
                                  </div>
                                  {fromToken === token.address && (
                                    <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
                                  )}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* From Amount */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-gray-900">
                          Amount
                        </label>
                        <span className="text-sm text-gray-600">
                          Balance: {parseFloat(getTokenBalance(fromToken)).toFixed(6)} {getTokenSymbol(fromToken, fromChain, true)}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.0"
                          step="0.000001"
                          className="input-field pr-20"
                disabled={isSwapping}
              />
                        <button
                          onClick={handleMaxAmount}
                          disabled={isSwapping || parseFloat(getTokenBalance(fromToken)) === 0}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-600 hover:text-orange-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          MAX
                        </button>
            </div>
            </div>
          </div>

          {/* Swap Arrow */}
          <div className="flex justify-center -my-3 relative z-10">
            <button
              onClick={() => {
                        // Swap chains and tokens
                        const tempChain = fromChain;
                        const tempToken = fromToken;
                        setFromChain(toChain);
                        setToChain(tempChain);
                        setFromToken(toToken || 'native');
                        setToToken(tempToken === 'native' ? '' : tempToken);
              }}
              className="p-4 glass-card hover:bg-white hover:shadow-md rounded-full transition-all border border-gray-200"
              disabled={isSwapping}
            >
              <ArrowDown className="w-6 h-6 text-orange-500" />
            </button>
                  </div>

                  <div className="glass-card p-6 space-y-6">
                    {/* To Chain */}
                    <div>
                      <label className="text-sm font-medium text-gray-900 mb-2 block">
                        To network
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => {
                            setShowToChainDropdown(!showToChainDropdown);
                            setShowFromChainDropdown(false);
                          }}
                          className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            {toChainConfig.logoUrl ? (
                              <img 
                                src={toChainConfig.logoUrl} 
                                alt={toChainConfig.name}
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <span className="text-xl">{toChainConfig.icon}</span>
                            )}
                            <span>{toChainConfig.name}</span>
                          </div>
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        </button>
                        
                        {showToChainDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
                          >
                            {Object.entries(CHAINS)
                              .filter(([key, chain]) => !chain.isTestnet)
                              .map(([key, chain]) => (
                                <button
                                  key={key}
                                  onClick={() => {
                                    setToChain(key);
                                    setShowToChainDropdown(false);
                                    // Reset token when chain changes
                                    setToToken('');
                                    setSelectedToToken(null);
                                  }}
                                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                                    toChain === key ? 'bg-orange-50' : ''
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
                                  {toChain === key && (
                                    <Check className="w-5 h-5 text-orange-500" />
                                  )}
                                </button>
                              ))}
                          </motion.div>
                        )}
                      </div>
          </div>

          {/* To Token */}
                    <div>
                      <label className="text-sm font-medium text-gray-900 mb-2 block">
                        To token
                      </label>
                      <button
                        onClick={() => {
                          setShowToTokenSearch(true);
                          setShowFromTokenDropdown(false);
                        }}
                        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {selectedToToken === 'native' ? (
                            <>
                              {toChainConfig.logoUrl ? (
                                <img 
                                  src={toChainConfig.logoUrl} 
                                  alt={toChainConfig.nativeCurrency.symbol}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
                                  <span className="text-white font-bold text-xs">
                                    {toChainConfig.nativeCurrency.symbol[0]}
                                  </span>
                                </div>
                              )}
                              <div className="text-left">
                                <div className="font-semibold">{toChainConfig.nativeCurrency.symbol}</div>
                                <div className="text-xs text-gray-500">{toChainConfig.nativeCurrency.name}</div>
                              </div>
                            </>
                          ) : selectedToToken ? (
                            <>
                              {selectedToToken.logoURI ? (
                                <img 
                                  src={selectedToToken.logoURI} 
                                  alt={selectedToToken.symbol}
                                  className="w-8 h-8 rounded-full"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
                                  <span className="text-white font-bold text-xs">
                                    {selectedToToken.symbol[0]}
                                  </span>
                                </div>
                              )}
                              <div className="text-left">
                                <div className="font-semibold">{selectedToToken.symbol}</div>
                                <div className="text-xs text-gray-500 truncate max-w-[200px]">{selectedToToken.name}</div>
                              </div>
                            </>
                          ) : (
                            <span className="font-semibold text-gray-500">Select token</span>
                          )}
                        </div>
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>

                    {/* To Amount (Read-only) */}
                    <div>
                      <label className="text-sm font-medium text-gray-900 mb-2 block">
                        You'll receive
                      </label>
                      <input
                type="text"
                        value={toAmount || '0.0'}
                readOnly
                placeholder="0.0"
                        className="input-field text-emerald-500 font-bold"
                      />
            </div>
          </div>

                  {/* Quote Card */}
          {quote && !error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-6 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200"
                    >
                      <div className="text-sm text-gray-600 mb-1">You'll receive</div>
                      <div className="text-4xl font-bold text-gray-900 mb-1">
                        {parseFloat(toAmount || '0').toFixed(6)} {getTokenSymbol(toToken, toChain)}
                      </div>
                      <div className="text-sm text-gray-600 mb-4">
                        {isJupiterQuote && quote ? (
                          // Jupiter quote - calculate USD from outAmount
                          `≈ ${formatUSDSync(parseFloat((quote as JupiterQuote).outAmount) / Math.pow(10, 9) * 150)} USD` // Approximate SOL price
                        ) : quote && 'estimate' in quote ? (
                          // Li.Fi quote
                          `≈ ${formatUSDSync(parseFloat(quote.estimate.toAmount) * parseFloat(quote.action.toToken.priceUSD || '0'))} USD`
                        ) : (
                          'Calculating...'
                        )}
                      </div>
                      
                      {/* Cross-chain indicator - Only for Li.Fi quotes */}
                      {fromChain !== toChain && !isJupiterQuote && quote && 'estimate' in quote && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                          <div className="flex items-center gap-2 text-blue-700 mb-2">
                            <ArrowRight className="w-5 h-5" />
                            <span className="font-semibold">Cross-chain swap</span>
                          </div>
                          <div className="text-sm text-blue-600">
                            Estimated time: {(quote as LiFiQuote).estimate.executionDuration}s
                          </div>
                        </div>
                      )}
                      
                      {/* Fees Breakdown - Only for Li.Fi quotes */}
                      {!isJupiterQuote && quote && 'estimate' in quote && (
                        <div className="space-y-2 text-sm">
                          {(quote as LiFiQuote).estimate.feeCosts.map((fee, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-gray-600">{fee.name}</span>
                <span className="font-semibold text-gray-900">
                                {parseFloat(fee.amount).toFixed(6)} {fee.token.symbol} ({fee.amountUSD} USD)
                </span>
              </div>
                          ))}
                          
                          {(quote as LiFiQuote).estimate.gasCosts.map((gas, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-gray-600">Gas ({gas.type})</span>
                              <span className="font-semibold text-gray-900">
                                {parseFloat(gas.amount).toFixed(6)} {gas.token.symbol} ({gas.amountUSD} USD)
                              </span>
              </div>
                          ))}
                          
                          <div className="h-px bg-gray-200 my-2" />
                          <div className="flex justify-between font-semibold text-base">
                            <span className="text-gray-900">Route</span>
                            <span className="text-gray-900">
                              {(quote as LiFiQuote).tool} {(quote as LiFiQuote).steps.length > 1 && `(${(quote as LiFiQuote).steps.length} steps)`}
                </span>
              </div>
                        </div>
                      )}
                      
                      {/* Jupiter-specific info */}
                      {isJupiterQuote && quote && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                          <div className="flex items-center gap-2 text-purple-700 mb-2">
                            <Flame className="w-5 h-5" />
                            <span className="font-semibold">Powered by Jupiter</span>
                          </div>
                          <div className="text-sm text-purple-600">
                            Price Impact: {(parseFloat((quote as JupiterQuote).priceImpactPct?.toString() || '0') * 100).toFixed(2)}%
                          </div>
                          <div className="text-sm text-purple-600">
                            Slippage: {(parseFloat((quote as JupiterQuote).slippageBps?.toString() || '0') / 100).toFixed(2)}%
                          </div>
                        </div>
                      )}
            </motion.div>
          )}

          {/* Loading State */}
          {isLoadingQuote && (
            <div className="flex items-center justify-center gap-3 text-orange-600 py-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Fetching best rate...</span>
            </div>
          )}

          {/* Swap Button */}
          <motion.button
            whileTap={{ scale: canSwap() ? 0.98 : 1 }}
                    onClick={() => setStep('confirm')}
            disabled={!canSwap()}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl text-white"
          >
                    {isLoadingQuote ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                        Loading...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                        {canSwap() ? 'Review swap' : 'Enter amount'}
              </>
            )}
          </motion.button>
                </>
              )}

              {/* Confirm Step */}
              {step === 'confirm' && quote && (
                <>
                  <div className="glass-card p-6 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200">
                    <div className="text-sm text-gray-600 mb-1">You're swapping</div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                      {parseFloat(fromAmount).toFixed(6)} {getTokenSymbol(fromToken, fromChain)}
                    </div>
                    <div className="text-sm text-gray-600 mb-4">
                      for {parseFloat(toAmount || '0').toFixed(6)} {getTokenSymbol(toToken, toChain)}
                    </div>
          </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={executeSwap}
                    disabled={isSwapping}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl text-white"
                  >
                    {isSwapping ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Flame className="w-5 h-5" />
                        Confirm swap
                      </>
                    )}
                  </motion.button>
                </>
              )}

              {/* Executing Step */}
              {step === 'executing' && (
                <div className="glass-card p-12 text-center">
                  <Loader2 className="w-16 h-16 animate-spin text-orange-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {totalSteps > 0 && `Step ${currentStepIndex} of ${totalSteps}`}
                  </h3>
                  <p className="text-gray-600 mb-4">{stepStatus}</p>
                  
                  {/* Progress Bar */}
                  {totalSteps > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                      <motion.div
                        className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentStepIndex / totalSteps) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                  
                  {txHash && (
                    <p className="text-sm text-gray-500 mt-4">
                      Transaction: <span className="font-mono">{txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Success Step */}
              {step === 'success' && (
                <div className="glass-card p-12 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Swap Successful!</h3>
                  <p className="text-gray-600 mb-6">
                    You have successfully swapped {parseFloat(fromAmount).toFixed(6)} {getTokenSymbol(fromToken, fromChain)} for {parseFloat(toAmount || '0').toFixed(6)} {getTokenSymbol(toToken, toChain)}
                  </p>
                  {txHash && (
                    <a
                      href={`${toChainConfig.explorerUrl}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-orange-600 hover:text-orange-700 underline"
                    >
                      View on explorer
                    </a>
                  )}
                    </div>
              )}
                  </div>
                </div>
              </div>
            </motion.div>

      {/* Token Search Modal */}
      <TokenSearchModal
        isOpen={showToTokenSearch}
        onClose={() => setShowToTokenSearch(false)}
        chainKey={toChain}
        selectedToken={toToken}
        onSelectToken={handleToTokenSelect}
        excludeTokens={fromToken && fromToken !== 'native' ? [fromToken] : []}
      />
    </AnimatePresence>
  );
}
