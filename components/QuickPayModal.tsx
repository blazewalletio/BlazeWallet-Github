'use client';

import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, CreditCard, Scan, Check, Camera, AlertCircle, ArrowRight, Copy, User, RefreshCw, ArrowUpRight, ArrowDownLeft, Loader2, AlertTriangle, ChevronDown, Search } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import QRCode from 'qrcode';
import ParticleEffect from './ParticleEffect';
import jsQR from 'jsqr';
import { QRParser, ParsedQRData, ChainType } from '@/lib/qr-parser';
import { lightningService, LightningInvoice } from '@/lib/lightning-service';
import { logger } from '@/lib/logger';
import { MultiChainService } from '@/lib/multi-chain-service';
import { priceService } from '@/lib/price-service';
import { CHAINS } from '@/lib/chains';
import { supabase } from '@/lib/supabase';
import { logTransactionEvent } from '@/lib/analytics-tracker';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Token } from '@/lib/types';
import Image from 'next/image';
import ContactsModal from './ContactsModal';
import SensitiveAction2FAModal from './SensitiveAction2FAModal';
import { contactsService, Contact } from '@/lib/contacts-service';
import { twoFactorSessionService } from '@/lib/2fa-session-service';

interface QuickPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMethod?: 'scanqr' | 'manual' | 'lightning'; // ⚡ NEW: Auto-select method
}

const PRESET_AMOUNTS_EUR = [5, 10, 20, 50, 100];

export default function QuickPayModal({ isOpen, onClose, initialMethod }: QuickPayModalProps) {
  // Main flow: 'method' | 'amount' | 'address' | 'scan' | 'chain-switch' | 'lightning' | 'lightning-send' | 'lightning-receive' | 'confirm' | 'processing' | 'success'
  const [mode, setMode] = useState<'method' | 'amount' | 'address' | 'scan' | 'chain-switch' | 'lightning' | 'lightning-send' | 'lightning-receive' | 'confirm' | 'processing' | 'success'>('method');
  const [paymentMethod, setPaymentMethod] = useState<'scanqr' | 'manual' | 'lightning' | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [lightningQR, setLightningQR] = useState('');
  const [lightningInvoice, setLightningInvoice] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedAddress, setScannedAddress] = useState<string>('');
  const [scannedAmount, setScannedAmount] = useState<string>('');
  
  // ⚡ Lightning specific states
  const [lightningAction, setLightningAction] = useState<'send' | 'receive' | null>(null);
  const [lightningInvoiceInput, setLightningInvoiceInput] = useState('');
  const [paymentMonitorInterval, setPaymentMonitorInterval] = useState<NodeJS.Timeout | null>(null);
  
  // 📱 Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  
  // 💵 USD conversion for QR amounts
  const [cryptoUSDValue, setCryptoUSDValue] = useState<number | null>(null);
  
  // ✅ NEW: Chain detection and switching
  const [parsedQR, setParsedQR] = useState<ParsedQRData | null>(null);
  const [needsChainSwitch, setNeedsChainSwitch] = useState(false);
  const [showChainSwitchDialog, setShowChainSwitchDialog] = useState(false); // ⚡ NEW: Chain switch confirmation
  
  // 📇 NEW: Contacts feature
  const [showContactsModal, setShowContactsModal] = useState(false);
  
  // 🔐 2FA SESSION SHIELD states
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingPaymentData, setPendingPaymentData] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  
  const { address, currentChain, switchChain, wallet, mnemonic, getCurrentAddress, tokens } = useWalletStore();
  const { formatUSDSync, symbol, convertUSD, selectedCurrency } = useCurrency();

  // ✅ NEW: Send to Address specific states
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<Token | null>(null); // 🆕 Selected token for sending
  const [showTokenDropdown, setShowTokenDropdown] = useState(false); // 🆕 Token dropdown visibility
  const [availableTokens, setAvailableTokens] = useState<Token[]>([]); // 🆕 All available tokens (native + ERC20/SPL)
  const [tokenSearchQuery, setTokenSearchQuery] = useState(''); // 🆕 Search query for token filter
  const tokenDropdownRef = useRef<HTMLDivElement>(null); // 🆕 Ref for dropdown click outside detection
  const [cryptoAmount, setCryptoAmount] = useState<string>('');
  const [nativePrice, setNativePrice] = useState<number>(0);
  const [estimatedGas, setEstimatedGas] = useState<number>(0);
  const [estimatedGasUSD, setEstimatedGasUSD] = useState<number>(0);
  const [isConverting, setIsConverting] = useState(false);
  const [isFetchingTokens, setIsFetchingTokens] = useState(false); // 🆕 Loading state for tokens
  const [error, setError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [step, setStep] = useState<'idle' | 'sending' | 'confirming' | 'success' | 'error'>('idle'); // ✅ Start in idle state
  const [balanceWarning, setBalanceWarning] = useState<{
    message: string;
    details: { need: string; have: string; missing: string; missingUSD: string };
  } | null>(null);
  const [pendingChainSwitch, setPendingChainSwitch] = useState<{
    from: string;
    to: string;
    address: string;
  } | null>(null);

  // Block body scroll when overlay is open
  useBlockBodyScroll(isOpen);

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

  const amount = selectedAmount || parseFloat(customAmount) || 0;


  // Camera functions
  const startCamera = async () => {
    try {
      setCameraError(null);
      setScanning(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        scanIntervalRef.current = window.setInterval(() => {
          scanQRCode();
        }, 100);
      }
    } catch (error: any) {
      logger.error('Camera error:', error);
      setCameraError('Could not access camera. Please grant camera permissions.');
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    setScanning(false);
  };

  // ⚡ LIGHTNING PAYMENT MONITORING
  const startPaymentMonitoring = (paymentHash: string) => {
    logger.log(`⚡ Starting payment monitoring for ${paymentHash.substring(0, 10)}...`);
    
    // Clear any existing interval
    if (paymentMonitorInterval) {
      clearInterval(paymentMonitorInterval);
    }

    // Poll every 2 seconds
    const interval = setInterval(async () => {
      try {
        const status = await lightningService.checkInvoiceStatus(paymentHash);
        
        if (status.settled) {
          logger.log('✅ Payment received!');
          clearInterval(interval);
          setPaymentMonitorInterval(null);
          
          // Show success
          setMode('success');
          setShowSuccess(true);
          
          setTimeout(() => {
            onClose();
            resetModal();
          }, 3000);
        }
      } catch (error) {
        logger.error('Failed to check payment status:', error);
      }
    }, 2000);

    setPaymentMonitorInterval(interval);

    // Auto-cleanup after 15 minutes (invoice expiry)
    setTimeout(() => {
      if (interval) {
        clearInterval(interval);
        setPaymentMonitorInterval(null);
        logger.log('⚠️ Payment monitoring stopped (invoice expired)');
      }
    }, 900000);
  };

  // Cleanup payment monitoring on unmount
  useEffect(() => {
    return () => {
      if (paymentMonitorInterval) {
        clearInterval(paymentMonitorInterval);
      }
    };
  }, [paymentMonitorInterval]);

  // 📱 Detect mobile on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(checkMobile);
    }
  }, []);

  // 💵 Fetch USD value when QR amount is scanned
  useEffect(() => {
    if (scannedAmount && parsedQR?.amount && currentChain) {
      const fetchUSDValue = async () => {
        try {
          const symbol = QRParser.getChainInfo(currentChain as ChainType)?.symbol;
          if (!symbol) return;
          
          // Fetch current price from API
          const response = await fetch(`/api/prices?symbols=${symbol}`);
          const data = await response.json();
          
          if (data[symbol]?.price) {
            const usdValue = parseFloat(scannedAmount) * data[symbol].price;
            setCryptoUSDValue(usdValue);
          }
        } catch (error) {
          logger.error('Error fetching USD value:', error);
          setCryptoUSDValue(null);
        }
      };
      
      fetchUSDValue();
    } else {
      setCryptoUSDValue(null);
    }
  }, [scannedAmount, parsedQR?.amount, currentChain]);

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    
    if (code) {
      logger.log('QR Code detected:', code.data);
      handleQRCodeDetected(code.data);
    }
  };

  const handleQRCodeDetected = (data: string) => {
    stopCamera();
    
    logger.log('🔍 [QuickPay] QR code detected (RAW):', data);
    logger.log('🔍 [QuickPay] QR code length:', data.length);
    logger.log('🔍 [QuickPay] QR code type:', typeof data);
    
    try {
      // ✅ Parse QR code using intelligent parser
      const parsed = QRParser.parse(data);
      setParsedQR(parsed);
      
      logger.log('📋 [QuickPay] Parsed result (FULL):', parsed);
      logger.log('📋 [QuickPay] Parsed result (SUMMARY):', {
        chain: parsed.chain,
        confidence: parsed.confidence,
        address: parsed.address ? (parsed.address.substring(0, 10) + '...') : 'NO ADDRESS',
        amount: parsed.amount,
        isValid: parsed.isValid,
        warnings: parsed.warnings,
        protocol: parsed.protocol,
      });
      
      // Check if QR is valid
      if (!parsed.isValid || parsed.chain === 'unknown') {
        logger.error('❌ [QuickPay] Invalid QR detected:', {
          isValid: parsed.isValid,
          chain: parsed.chain,
          warnings: parsed.warnings,
          rawData: data,
        });
        
        // More helpful error message
        let errorMessage = '❌ Invalid QR Code\n\n';
        
        if (parsed.warnings && parsed.warnings.length > 0) {
          errorMessage += parsed.warnings.join('\n') + '\n\n';
      } else {
          errorMessage += 'Could not recognize blockchain address.\n\n';
        }
        
        // Add troubleshooting tips
        errorMessage += '💡 Troubleshooting:\n';
        errorMessage += '• Make sure the QR code is clear\n';
        errorMessage += '• Try better lighting\n';
        errorMessage += '• Supported chains:\n';
        errorMessage += '  - Ethereum & EVM chains\n';
        errorMessage += '  - Solana\n';
        errorMessage += '  - Bitcoin\n';
        errorMessage += '  - Litecoin\n';
        errorMessage += '  - Dogecoin\n';
        errorMessage += '  - Bitcoin Cash\n';
        errorMessage += '\n📋 Scanned data:\n' + data.substring(0, 100);
        
        alert(errorMessage);
        setMode('scan');
        startCamera();
        return;
      }
      
      // ✅ FIXED: Check if chain switch is needed for ALL chains
      const detectedChain = parsed.chain;
      
      if (detectedChain !== currentChain) {
        // Chain mismatch detected - need to switch
        logger.log(`🔄 [QuickPay] Chain switch needed: ${currentChain} → ${detectedChain}`);
        setNeedsChainSwitch(true);
        setMode('chain-switch');
      } else {
        // Same chain - proceed directly to confirmation
        logger.log(`✅ [QuickPay] Chain matches: ${detectedChain}`);
        setScannedAddress(parsed.address);
        setScannedAmount(parsed.amount || '');
        setMode('confirm');
      }
    } catch (error) {
      logger.error('❌ Error parsing QR code:', error);
      toast('Could not parse QR code. Please try again.');
      setMode('scan');
      startCamera();
    }
  };

  const handleAddressScan = (data: string) => {
    stopCamera();
    
    let detectedAddress = '';
    
    try {
      if (data.startsWith('ethereum:')) {
        detectedAddress = data.split('ethereum:')[1].split('?')[0];
      } else if (data.startsWith('0x') && data.length === 42) {
        detectedAddress = data;
      } else if (data.length >= 26 && data.length <= 42) {
        detectedAddress = data;
      }
      
      if (detectedAddress) {
        setRecipientAddress(detectedAddress);
        setMode('address');
      } else {
        toast.error('Invalid wallet address QR code.');
        setMode('address');
      }
    } catch (error) {
      logger.error('Error parsing address QR:', error);
      toast('Could not parse QR code.');
      setMode('address');
    }
  };

  useEffect(() => {
    if (mode === 'scan' && !scanning) {
      startCamera();
    }
    
    return () => {
      if (mode !== 'scan') {
        stopCamera();
      }
    };
  }, [mode]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // ✅ Click outside detection for token dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setShowTokenDropdown(false);
        setTokenSearchQuery('');
      }
    };

    if (showTokenDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTokenDropdown]);

  const generateLightningQR = async () => {
    if (!amount) return;
    
    const lightningInvoice = `lightning:lnbc${amount * 10000}u1p3xnhqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqsfpp3x9et2e20v6pu37c5d9vax37wxq72un98k6vcx9fz94w0qf237cm`;
    
    try {
      const qr = await QRCode.toDataURL(lightningInvoice, {
        width: 400,
        margin: 2,
        color: {
          dark: '#f97316',
          light: '#FFFFFF',
        },
      });
      setLightningQR(qr);
      setMode('lightning');
    } catch (error) {
      logger.error('Error generating QR:', error);
    }
  };

  // 🆕 Fetch all available tokens for current chain
  const fetchAvailableTokens = async () => {
    setIsFetchingTokens(true);
    
    try {
      const currentAddress = getCurrentAddress();
      if (!currentAddress) {
        logger.warn('[QuickPay] No address available');
        setIsFetchingTokens(false);
        return;
      }

      logger.log(`\n🪙 [QuickPay] Fetching tokens for ${currentChain}...`);
      
      const chainConfig = CHAINS[currentChain];
      const blockchain = MultiChainService.getInstance(currentChain);
      
      // Get native balance
      const nativeBalance = await blockchain.getBalance(currentAddress);
      
      // Get native price from CoinGecko Pro (via API route)
      logger.log(`\n╔══════════════════════════════════════════════════════════════╗`);
      logger.log(`║  🔍 DEBUG: NATIVE TOKEN PRICE FETCHING - START              ║`);
      logger.log(`╚══════════════════════════════════════════════════════════════╝`);
      logger.log(`📍 Chain: ${currentChain}`);
      logger.log(`📍 Native Symbol: ${chainConfig.nativeCurrency.symbol}`);
      logger.log(`📍 Calling: priceService.getMultiplePrices(['${chainConfig.nativeCurrency.symbol}'])`);
      
      const nativePriceData = await priceService.getMultiplePrices([chainConfig.nativeCurrency.symbol]);
      
      // Debug: Log the full response
      logger.log(`\n📦 RAW RESPONSE FROM priceService.getMultiplePrices():`);
      logger.log(`   Type: ${typeof nativePriceData}`);
      logger.log(`   Is null: ${nativePriceData === null}`);
      logger.log(`   Is undefined: ${nativePriceData === undefined}`);
      logger.log(`   Keys: ${nativePriceData ? Object.keys(nativePriceData).join(', ') : 'N/A'}`);
      logger.log(`   Full object:`, JSON.stringify(nativePriceData, null, 2));
      
      logger.log(`\n📦 ${chainConfig.nativeCurrency.symbol} SPECIFIC DATA:`);
      const symbolData = nativePriceData[chainConfig.nativeCurrency.symbol];
      logger.log(`   Exists: ${!!symbolData}`);
      logger.log(`   Type: ${typeof symbolData}`);
      logger.log(`   Full data:`, JSON.stringify(symbolData, null, 2));
      
      if (symbolData) {
        logger.log(`\n📊 FIELD-BY-FIELD ANALYSIS:`);
        logger.log(`   symbolData.price exists: ${symbolData.price !== undefined}`);
        logger.log(`   symbolData.price type: ${typeof symbolData.price}`);
        logger.log(`   symbolData.price value: ${symbolData.price}`);
        logger.log(`   symbolData.price === 0: ${symbolData.price === 0}`);
        logger.log(`   symbolData.price > 0: ${symbolData.price > 0}`);
        logger.log(`   symbolData.change24h exists: ${symbolData.change24h !== undefined}`);
        logger.log(`   symbolData.change24h type: ${typeof symbolData.change24h}`);
        logger.log(`   symbolData.change24h value: ${symbolData.change24h}`);
      }
      
      const nativePrice = nativePriceData[chainConfig.nativeCurrency.symbol]?.price || 0;
      const nativePriceChange = nativePriceData[chainConfig.nativeCurrency.symbol]?.change24h || 0;
      const nativeUsdValue = parseFloat(nativeBalance) * nativePrice;
      
      logger.log(`\n🧮 EXTRACTED VALUES:`);
      logger.log(`   nativePrice: ${nativePrice} (type: ${typeof nativePrice})`);
      logger.log(`   nativePriceChange: ${nativePriceChange} (type: ${typeof nativePriceChange})`);
      logger.log(`   nativeBalance: ${nativeBalance}`);
      logger.log(`   nativeUsdValue: ${nativeUsdValue}`);
      
      if (nativePrice === 0) {
        logger.error(`\n❌ CRITICAL: Failed to get ${chainConfig.nativeCurrency.symbol} price!`);
        logger.error(`   Full response object:`, nativePriceData);
        logger.error(`   ${chainConfig.nativeCurrency.symbol} data:`, symbolData);
        logger.error(`   This suggests the API returned price: 0`);
        logger.error(`   Check /api/prices route logs for more details`);
      } else {
        logger.log(`\n✅ SUCCESS: ${chainConfig.nativeCurrency.symbol} price: $${nativePrice} (${nativePriceChange >= 0 ? '+' : ''}${nativePriceChange.toFixed(2)}%)`);
      }
      
      logger.log(`\n╔══════════════════════════════════════════════════════════════╗`);
      logger.log(`║  🔍 DEBUG: NATIVE TOKEN PRICE FETCHING - END                ║`);
      logger.log(`╚══════════════════════════════════════════════════════════════╝\n`);
      
      // Create native token
      const nativeToken: Token = {
        address: 'native',
        symbol: chainConfig.nativeCurrency.symbol,
        name: chainConfig.name,
        decimals: chainConfig.nativeCurrency.decimals,
        balance: nativeBalance,
        logo: chainConfig.logoUrl || chainConfig.icon || '/crypto-placeholder.png',
        priceUSD: nativePrice,
        change24h: nativePriceChange,
        balanceUSD: nativeUsdValue.toString(),
      };
      
      const allTokens: Token[] = [nativeToken];
      
      // Get ERC20/SPL tokens based on chain
      if (currentChain === 'solana') {
        // Solana SPL tokens
        const splTokens = await blockchain.getSPLTokenBalances(currentAddress);
        logger.log(`🪙 [QuickPay] Found ${splTokens.length} SPL tokens`);
        
        // ⚡ BATCH FETCH: Get all SPL token prices in ONE API call (fast!)
        const splSymbols = splTokens.map(t => t.symbol);
        logger.log(`📡 [QuickPay] Batch fetching ${splSymbols.length} SPL token prices...`);
        const splPrices = await priceService.getMultiplePrices(splSymbols);
        
        // Map prices to tokens
        splTokens.forEach(token => {
          const tokenPrice = splPrices[token.symbol]?.price || 0;
          const tokenChange = splPrices[token.symbol]?.change24h || 0;
          const tokenBalance = parseFloat(token.balance || '0');
          const tokenUsdValue = tokenBalance * tokenPrice;
          
          logger.log(`  💰 ${token.symbol}: ${tokenBalance.toFixed(4)} tokens @ $${tokenPrice.toFixed(2)} = $${tokenUsdValue.toFixed(2)}`);
          
          allTokens.push({
            ...token,
            priceUSD: tokenPrice,
            change24h: tokenChange,
            balanceUSD: tokenUsdValue.toString(),
          });
        });
        
      } else if (chainConfig.id) {
        // EVM chains have numeric IDs (Ethereum, Polygon, BSC, etc.)
        const erc20Tokens = await blockchain.getERC20TokenBalances(currentAddress);
        logger.log(`🪙 [QuickPay] Found ${erc20Tokens.length} ERC20 tokens`);
        
        // ⚡ BATCH FETCH: Get prices for tokens that don't have them yet
        const tokensNeedingPrices = erc20Tokens.filter(t => !t.priceUSD || t.priceUSD === 0);
        
        if (tokensNeedingPrices.length > 0) {
          const erc20Symbols = tokensNeedingPrices.map(t => t.symbol);
          logger.log(`📡 [QuickPay] Batch fetching ${erc20Symbols.length} ERC20 token prices...`);
          const erc20Prices = await priceService.getMultiplePrices(erc20Symbols);
          
          // Apply fetched prices to tokens
          tokensNeedingPrices.forEach(token => {
            token.priceUSD = erc20Prices[token.symbol]?.price || 0;
            token.change24h = erc20Prices[token.symbol]?.change24h || 0;
          });
        }
        
        // Map all ERC20 tokens with their prices
        erc20Tokens.forEach(token => {
          const tokenPrice = token.priceUSD || 0;
          const priceChange = token.change24h || 0;
          const tokenBalance = parseFloat(token.balance || '0');
          const tokenUsdValue = tokenBalance * tokenPrice;
          
          logger.log(`  💰 ${token.symbol}: ${tokenBalance.toFixed(4)} tokens @ $${tokenPrice.toFixed(2)} = $${tokenUsdValue.toFixed(2)}`);
          
          allTokens.push({
            ...token,
            priceUSD: tokenPrice,
            change24h: priceChange,
            balanceUSD: tokenUsdValue.toString(),
          });
        });
      }
      
      // Sort by USD value (highest first)
      const sortedTokens = allTokens.sort((a, b) => {
        const aValue = parseFloat(a.balanceUSD || '0');
        const bValue = parseFloat(b.balanceUSD || '0');
        return bValue - aValue;
      });
      
      logger.log(`✅ [QuickPay] Total tokens available: ${sortedTokens.length}`);
      logger.log(`   Sorted by USD value (highest first)`);
      
      setAvailableTokens(sortedTokens);
      
      // Auto-select native token by default
      if (!selectedToken && sortedTokens.length > 0) {
        setSelectedToken(sortedTokens[0]);
        logger.log(`✅ [QuickPay] Auto-selected native token: ${sortedTokens[0].symbol}`);
      }
      
    } catch (err: any) {
      logger.error('❌ [QuickPay] Failed to fetch tokens:', err);
      
      // Fallback: just show native token
      const chainConfig = CHAINS[currentChain];
      const fallbackToken: Token = {
        address: 'native',
        symbol: chainConfig.nativeCurrency.symbol,
        name: chainConfig.name,
        decimals: chainConfig.nativeCurrency.decimals,
        balance: '0',
        logo: chainConfig.logoUrl || chainConfig.icon || '/crypto-placeholder.png',
        priceUSD: 0,
        balanceUSD: '0',
      };
      
      setAvailableTokens([fallbackToken]);
      setSelectedToken(fallbackToken);
    } finally {
      setIsFetchingTokens(false);
    }
  };

  const handleMethodSelect = (method: 'scanqr' | 'manual' | 'lightning') => {
    // ⚡ NEW: Check if Lightning requires chain switch
    if (method === 'lightning' && currentChain !== 'bitcoin') {
      setPaymentMethod(method);
      setShowChainSwitchDialog(true);
      return;
    }

    setPaymentMethod(method);
    
    if (method === 'scanqr') {
      setMode('scan');
    } else if (method === 'manual') {
      // 🆕 Fetch available tokens when entering manual send flow
      fetchAvailableTokens();
      setMode('amount');
    } else if (method === 'lightning') {
      setMode('lightning'); // ⚡ Go directly to Lightning flow
    }
  };

  // ⚡ Handle chain switch confirmation
  const handleChainSwitch = () => {
    // Handle Lightning chain switch (to Bitcoin)
    if (paymentMethod === 'lightning' || lightningAction) {
    switchChain('bitcoin');
    setShowChainSwitchDialog(false);
    setMode('lightning');
      return;
    }
    
    // Handle Address-based chain switch
    if (pendingChainSwitch) {
      logger.log(`✅ [QuickPay] Switching chain: ${pendingChainSwitch.from} → ${pendingChainSwitch.to}`);
      switchChain(pendingChainSwitch.to);
      setShowChainSwitchDialog(false);
      setPendingChainSwitch(null);
      
      // Re-validate address on new chain
      setTimeout(() => {
        handleAddressNext();
      }, 300);
    }
  };

  // ⚡ NEW: Auto-select method on open (must be after handleMethodSelect definition)
  useEffect(() => {
    if (isOpen && initialMethod) {
      handleMethodSelect(initialMethod);
    } else if (isOpen && !initialMethod) {
      // Reset to method selection when opening without initialMethod
      setMode('method');
      setPaymentMethod(null);
      setLightningAction(null);
    }
  }, [isOpen, initialMethod]);

  const handleAmountNext = async () => {
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (!selectedToken) {
      toast.error('Please select a token to send');
      return;
    }
    
    if (paymentMethod === 'manual') {
      // ✅ Convert user's currency to Crypto
      setIsConverting(true);
      setError('');
      
      try {
        logger.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
        logger.log(`║    🔥 [QuickPay] CURRENCY CONVERSION DEBUG - START           ║`);
        logger.log(`╚═══════════════════════════════════════════════════════════════╝\n`);
        
        const chainConfig = CHAINS[currentChain];
        const tokenSymbol = selectedToken.symbol;
        const isNative = selectedToken.address === 'native';
        
        logger.log(`📍 STEP 1: Initial Data`);
        logger.log(`   Current Chain: ${currentChain}`);
        logger.log(`   Selected Token: ${tokenSymbol} (${selectedToken.name})`);
        logger.log(`   Is Native: ${isNative}`);
        logger.log(`   Token Address: ${selectedToken.address}`);
        logger.log(`   User Amount: ${symbol}${amount}`);
        logger.log(`   User Currency: ${selectedCurrency}`);
        logger.log(`   Token Balance: ${selectedToken.balance} ${tokenSymbol}`);
        
        logger.log(`\n💱 [QuickPay] Converting ${symbol}${amount} to ${tokenSymbol}...\n`);
        
        // Fetch current price in USD
        logger.log(`\n📍 STEP 2: Fetching ${tokenSymbol} price in USD...`);
        
        let priceUSD = 0;
        
        if (isNative) {
          logger.log(`   Method: CoinGecko Pro (via API route - native token)`);
          logger.log(`   This uses: CoinGecko Pro (primary) → Binance (fallback)`);
          
          const priceResult = await priceService.getMultiplePrices([tokenSymbol]);
          
          logger.log(`   Raw priceResult response:`, priceResult);
          priceUSD = priceResult[tokenSymbol]?.price || 0;
        } else {
          logger.log(`   Method: Using cached price from token data (ERC20/SPL)`);
          priceUSD = selectedToken.priceUSD || 0;
          
          // If no cached price, try to fetch from CoinGecko Pro
          if (!priceUSD) {
            logger.log(`   No cached price, fetching from CoinGecko Pro...`);
            const priceData = await priceService.getMultiplePrices([tokenSymbol]);
            priceUSD = priceData[tokenSymbol]?.price || 0;
          }
        }
        
        logger.log(`   Extracted price: $${priceUSD}`);
        logger.log(`   Price is valid: ${priceUSD > 0}`);
        
        // Handle tokens without price data
        if (!priceUSD || priceUSD === 0) {
          logger.error(`⚠️ [QuickPay] No price data for ${tokenSymbol}`);
          
          // Show user-friendly error message
          const errorMsg = `Unable to convert ${symbol}${amount} to ${tokenSymbol}. Price data is currently unavailable for this token. Please try again later or select a different token.`;
          setError(errorMsg);
          toast.error(errorMsg);
          setIsConverting(false);
          return;
        }
        
        logger.log(`✅ ${tokenSymbol} price fetched: $${priceUSD}`);
        
        // Convert user's currency amount to USD first
        logger.log(`\n📍 STEP 3: Converting ${symbol}${amount} to USD...`);
        logger.log(`   User currency: ${selectedCurrency}`);
        logger.log(`   User amount: ${amount}`);
        logger.log(`   Calling: convertUSD(${amount})`);
        
        const amountUSD = await convertUSD(amount); // Converts from selected currency to USD
        
        logger.log(`   Result: $${amountUSD}`);
        logger.log(`   Conversion valid: ${amountUSD > 0}`);
        
        if (!amountUSD || amountUSD <= 0) {
          logger.error(`❌ CRITICAL: Currency conversion to USD failed`);
          logger.error(`   Input: ${symbol}${amount}`);
          logger.error(`   Output: $${amountUSD}`);
          throw new Error(`Failed to convert ${symbol}${amount} to USD`);
        }
        
        // Then convert USD to crypto
        logger.log(`\n📍 STEP 4: Converting USD to ${tokenSymbol}...`);
        logger.log(`   USD amount: $${amountUSD}`);
        logger.log(`   ${tokenSymbol} price: $${priceUSD}`);
        logger.log(`   Calculation: ${amountUSD} / ${priceUSD}`);
        
        const cryptoAmt = amountUSD / priceUSD;
        
        logger.log(`   Result: ${cryptoAmt} ${tokenSymbol}`);
        logger.log(`   Result (6 decimals): ${cryptoAmt.toFixed(6)} ${tokenSymbol}`);
        
        setCryptoAmount(cryptoAmt.toString());
        setNativePrice(priceUSD);
        
        logger.log(`\n✅ [QuickPay] ${symbol}${amount} → $${amountUSD.toFixed(2)} → ${cryptoAmt.toFixed(6)} ${tokenSymbol}`);
        
        // Estimate gas (always in native token)
        logger.log(`\n📍 STEP 5: Estimating gas fees...`);
        logger.log(`   Chain type: ${currentChain}`);
        logger.log(`   Gas paid in: ${chainConfig.nativeCurrency.symbol} (native token)`);
        
        const blockchain = MultiChainService.getInstance(currentChain);
        logger.log(`   Blockchain service initialized`);
        
        const gasPrices = await blockchain.getGasPrice();
        logger.log(`   Gas prices fetched:`, gasPrices);
        
        // Get native token price for gas calculation
        const nativePriceResult = await priceService.getMultiplePrices([chainConfig.nativeCurrency.symbol]);
        const nativeTokenPrice = nativePriceResult[chainConfig.nativeCurrency.symbol]?.price || 0;
        
        let gasAmount = 0;
        if (currentChain === 'solana') {
          gasAmount = 0.000005; // Fixed SOL fee
          logger.log(`   Using fixed Solana fee: ${gasAmount} SOL`);
        } else if (currentChain === 'bitcoin' || currentChain === 'litecoin' || currentChain === 'dogecoin' || currentChain === 'bitcoincash') {
          // Bitcoin-like chains: ~0.0001 BTC/LTC/DOGE/BCH
          gasAmount = 0.0001;
          logger.log(`   Using fixed Bitcoin-like fee: ${gasAmount} ${chainConfig.nativeCurrency.symbol}`);
        } else {
          // EVM chains: calculate from gas price
          const gasPrice = parseFloat(gasPrices.standard);
          // ERC20 transfers need more gas (~65000) than native transfers (~21000)
          const gasLimit = isNative ? 21000 : 65000;
          gasAmount = (gasPrice * gasLimit) / 1e9;
          logger.log(`   EVM chain calculation:`);
          logger.log(`      Gas price: ${gasPrice} gwei`);
          logger.log(`      Gas limit: ${gasLimit} (${isNative ? 'native' : 'ERC20'} transfer)`);
          logger.log(`      Calculated fee: ${gasAmount} ${chainConfig.nativeCurrency.symbol}`);
        }
        
        const gasUSD = gasAmount * nativeTokenPrice;
        
        setEstimatedGas(gasAmount);
        setEstimatedGasUSD(gasUSD);
        
        logger.log(`\n⛽ Gas Estimation Complete:`);
        logger.log(`   Gas amount: ${gasAmount.toFixed(6)} ${chainConfig.nativeCurrency.symbol}`);
        logger.log(`   Gas in USD: $${gasUSD.toFixed(4)}`);
        logger.log(`   Gas in user currency: ${formatUSDSync(gasUSD)}`);
        
        logger.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
        logger.log(`║    ✅ [QuickPay] CONVERSION COMPLETE - SUCCESS               ║`);
        logger.log(`╚═══════════════════════════════════════════════════════════════╝`);
        logger.log(`📊 SUMMARY:`);
        logger.log(`   Input: ${symbol}${amount}`);
        logger.log(`   USD: $${amountUSD.toFixed(2)}`);
        logger.log(`   Token: ${cryptoAmt.toFixed(6)} ${tokenSymbol}`);
        logger.log(`   Token Type: ${isNative ? 'Native' : 'ERC20/SPL'}`);
        logger.log(`   Price: $${priceUSD}/per ${tokenSymbol}`);
        logger.log(`   Gas: ${gasAmount.toFixed(6)} ${chainConfig.nativeCurrency.symbol} ($${gasUSD.toFixed(4)})`);
        logger.log(`═══════════════════════════════════════════════════════════════\n`);
        
        setIsConverting(false);
      setMode('address');
      } catch (err: any) {
        logger.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
        logger.log(`║    ❌ [QuickPay] CONVERSION FAILED - ERROR                   ║`);
        logger.log(`╚═══════════════════════════════════════════════════════════════╝`);
        logger.error('❌ [QuickPay] Conversion failed:', err);
        logger.error(`   Error type: ${err.constructor.name}`);
        logger.error(`   Error message: ${err.message}`);
        logger.error(`   Error stack:`, err.stack);
        logger.log(`═══════════════════════════════════════════════════════════════\n`);
        
        setError('Failed to get current exchange rate. Please try again.');
        setIsConverting(false);
      }
    } else if (paymentMethod === 'lightning') {
      generateLightningQR();
    }
  };

  // ✅ Auto-detect chain from address
  const detectChainFromAddress = (addr: string): string | null => {
    // EVM addresses (0x... en 42 chars)
    if (addr.startsWith('0x') && addr.length === 42) {
      // EVM chain - keep current if also EVM
      const evmChains = ['ethereum', 'polygon', 'arbitrum', 'base', 'bsc', 'optimism', 'avalanche', 'fantom', 'cronos', 'zksync', 'linea'];
      if (evmChains.includes(currentChain)) {
        return currentChain; // Stay on current EVM chain
      }
      return 'ethereum'; // Default to Ethereum
    }
    
    // Solana (base58, 32-44 chars, geen 0x)
    if (!addr.startsWith('0x') && addr.length >= 32 && addr.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr)) {
      return 'solana';
    }
    
    // Bitcoin (bc1..., 1..., 3...)
    if (addr.startsWith('bc1') || (addr.startsWith('1') && addr.length >= 26 && addr.length <= 35) || (addr.startsWith('3') && addr.length >= 26 && addr.length <= 35)) {
      return 'bitcoin';
    }
    
    // Litecoin (L..., M..., ltc1...)
    if (addr.startsWith('L') || addr.startsWith('M') || addr.startsWith('ltc1')) {
      return 'litecoin';
    }
    
    // Dogecoin (D...)
    if (addr.startsWith('D')) {
      return 'dogecoin';
    }
    
    // Bitcoin Cash (q..., p..., bitcoincash:...)
    if (addr.startsWith('q') || addr.startsWith('p') || addr.includes('bitcoincash:')) {
      return 'bitcoincash';
    }
    
    return null;
  };

  const handleAddressNext = async () => {
    setError('');
    
    if (!recipientAddress || recipientAddress.length < 26) {
      setError('Please enter a valid wallet address');
      return;
    }
    
    // ✅ Auto-detect chain from address
    const detectedChain = detectChainFromAddress(recipientAddress);
    
    if (detectedChain && detectedChain !== currentChain) {
      // Chain mismatch - show switch dialog
      logger.log(`🔄 [QuickPay] Chain switch needed: ${currentChain} → ${detectedChain}`);
      setPendingChainSwitch({
        from: currentChain,
        to: detectedChain,
        address: recipientAddress
      });
      setShowChainSwitchDialog(true);
      return;
    }
    
    // ✅ Validate address for current chain
    const blockchain = MultiChainService.getInstance(currentChain);
    if (!blockchain.isValidAddress(recipientAddress)) {
      setError(`Invalid ${blockchain.getAddressFormatHint()}`);
      return;
    }
    
    // ✅ Check balance
    const currentAddress = getCurrentAddress();
    if (!currentAddress) {
      setError('Wallet address not found');
      return;
    }
    
    try {
      const currentBalance = await blockchain.getBalance(currentAddress);
      const balanceNum = parseFloat(currentBalance);
      const cryptoAmountNum = parseFloat(cryptoAmount);
      const total = cryptoAmountNum + estimatedGas;
      
      if (total > balanceNum) {
        const chainConfig = CHAINS[currentChain];
        const missing = total - balanceNum;
        
        setBalanceWarning({
          message: 'Insufficient balance (including gas fees)',
          details: {
            need: `${total.toFixed(6)} ${chainConfig.nativeCurrency.symbol}`,
            have: `${balanceNum.toFixed(6)} ${chainConfig.nativeCurrency.symbol}`,
            missing: `${missing.toFixed(6)} ${chainConfig.nativeCurrency.symbol}`,
            missingUSD: formatUSDSync(missing * nativePrice)
          }
        });
        setError('Insufficient balance for transaction + gas fees');
        return;
      }
      
      setBalanceWarning(null);
    setScannedAddress(recipientAddress);
    setStep('idle'); // ✅ Reset to idle state for confirm screen
    setMode('confirm');
    } catch (err: any) {
      logger.error('❌ [QuickPay] Balance check failed:', err);
      setError('Failed to verify balance. Please try again.');
    }
  };

  const handleConfirmPayment = async () => {
    if (!mnemonic && !wallet) {
      setError('Wallet not initialized');
      return;
    }
    
    // 🔐 SESSION SHIELD: Check if 2FA is required
    if (userId) {
      const sendValueUSD = parseFloat(cryptoAmount) * nativePrice;
      
      const sessionStatus = await twoFactorSessionService.checkActionRequires2FA(userId, {
        action: 'send',
        amountUSD: sendValueUSD,
      });

      if (sessionStatus.required) {
        logger.log('🔒 2FA verification required for QuickPay transaction');
        
        // Store transaction data to execute after 2FA
        setPendingPaymentData({
          sendValueUSD,
        });
        
        // Show 2FA modal
        setShow2FAModal(true);
        return; // Wait for 2FA verification
      }

      logger.log('✅ 2FA session valid - proceeding with QuickPay');
    }

    // Execute the payment
    await executePayment();
  };

  // 🔐 Separated payment logic (called after 2FA if needed)
  const executePayment = async () => {
    if (!mnemonic && !wallet) {
      setError('Wallet not initialized');
      return;
    }
    
    setStep('sending');
    setError('');
    
    // Define toAddr early for error handling
    const toAddr = scannedAddress || recipientAddress;
    
    // Track send initiation
    const sendValueUSD = pendingPaymentData?.sendValueUSD || (parseFloat(cryptoAmount) * nativePrice);
    await logTransactionEvent({
      eventType: 'send_initiated',
      chainKey: currentChain,
      tokenSymbol: selectedToken?.symbol || CHAINS[currentChain].nativeCurrency.symbol,
      valueUSD: sendValueUSD,
      status: 'pending',
      metadata: {
        isNative: !selectedToken || selectedToken.address === 'native',
        toAddress: toAddr,
        source: 'quickpay'
      },
    });

    try {
      const blockchain = MultiChainService.getInstance(currentChain);
      const gasPrices = await blockchain.getGasPrice();
      const gas = gasPrices['standard'];
      
      const isSolana = currentChain === 'solana';
      
      logger.log(`🚀 [QuickPay] Sending ${cryptoAmount} ${selectedToken?.symbol || CHAINS[currentChain].nativeCurrency.symbol} to ${toAddr}...`);
      
      // Send transaction (native or token)
      let tx;
      if (!selectedToken || selectedToken.address === 'native') {
        // Native token
        tx = await blockchain.sendTransaction(
          isSolana ? mnemonic! : wallet!,
          toAddr,
          cryptoAmount,
          gas
        );
      } else {
        // ERC20/SPL token
        tx = await blockchain.sendTokenTransaction(
          isSolana ? mnemonic! : wallet!,
          selectedToken.address,
          toAddr,
          cryptoAmount,
          selectedToken.decimals,
          gas
        );
      }
      
      const hash = typeof tx === 'string' ? tx : tx.hash;
      setTxHash(hash);
      
      // Clear pending data
      setPendingPaymentData(null);
      
      logger.log(`✅ [QuickPay] Transaction sent: ${hash}`);
      
      // Track successful send
      await logTransactionEvent({
        eventType: 'send_confirmed',
        chainKey: currentChain,
        tokenSymbol: selectedToken?.symbol || CHAINS[currentChain].nativeCurrency.symbol,
        valueUSD: sendValueUSD,
        status: 'success',
        referenceId: hash,
        metadata: {
          isNative: !selectedToken || selectedToken.address === 'native',
          toAddress: toAddr,
          source: 'quickpay'
        },
      });

      // ✅ Track transaction in database
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const currentAddress = getCurrentAddress();
            
          await fetch('/api/transactions/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              chainKey: currentChain,
              txHash: hash,
              transactionType: 'send',
              direction: 'sent',
              fromAddress: currentAddress,
              toAddress: toAddr,
              tokenSymbol: CHAINS[currentChain].nativeCurrency.symbol,
              tokenDecimals: CHAINS[currentChain].nativeCurrency.decimals,
              isNative: true,
              amount: cryptoAmount,
              amountUSD: sendValueUSD,
              gasCostUSD: estimatedGasUSD,
              status: 'confirmed',
              metadata: {
                source: 'quickpay',
                currency: selectedCurrency
              }
            })
          });
          logger.log('✅ [QuickPay] Transaction tracked in database');
        }
      } catch (trackError) {
        logger.error('Failed to track transaction:', trackError);
      }
      
      // ✅ Clear cache
      const { tokenBalanceCache } = await import('@/lib/token-balance-cache');
      const currentAddress = getCurrentAddress();
      if (currentAddress) {
        await tokenBalanceCache.clear(currentChain, currentAddress);
      }
      
      // Wait for confirmation
      if (typeof tx !== 'string' && tx.wait) {
        await tx.wait();
      }
      
      setMode('success');
      setShowSuccess(true);
      
      setTimeout(() => {
        onClose();
        resetModal();
      }, 3000);
      
    } catch (err: any) {
      logger.error('❌ [QuickPay] Transaction failed:', err);
      
      // User-friendly error messages (from SendModal)
      let userMessage = 'Transaction failed';
      
      if (err.message) {
        const msg = err.message.toLowerCase();
        
        if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) {
          userMessage = 'Insufficient balance to cover transaction and gas fees';
        } else if (msg.includes('user rejected') || msg.includes('user denied')) {
          userMessage = 'Transaction was cancelled';
        } else if (msg.includes('gas required exceeds allowance') || msg.includes('out of gas')) {
          userMessage = 'Transaction requires more gas. Try again.';
        } else if (msg.includes('nonce too low')) {
          userMessage = 'Transaction conflict. Please try again.';
        } else if (msg.includes('replacement transaction underpriced')) {
          userMessage = 'Transaction pending. Please wait.';
        } else if (msg.includes('no response') || msg.includes('failed to send tx')) {
          userMessage = 'Network error. Please try again.';
        } else if (msg.includes('invalid address')) {
          userMessage = 'Invalid recipient address';
        } else {
          userMessage = 'Transaction failed. Please try again.';
        }
      }
      
      setError(userMessage);
      setMode('confirm');
      
      // Track failed send
      await logTransactionEvent({
        eventType: 'send_failed',
        chainKey: currentChain,
        tokenSymbol: CHAINS[currentChain].nativeCurrency.symbol,
        valueUSD: sendValueUSD,
        status: 'failed',
        metadata: {
          isNative: true,
          toAddress: toAddr,
          error: userMessage,
          source: 'quickpay'
        },
      });
    }
  };

  const handlePasteAddress = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.length >= 26) {
        setRecipientAddress(text);
      } else {
        toast.error('Invalid address in clipboard');
      }
    } catch (error) {
      toast('Could not access clipboard. Please paste manually.');
    }
  };

  // 📇 Handle contact selection
  const handleSelectContact = async (contact: Contact) => {
    setRecipientAddress(contact.address);
    toast.success(`✅ Selected: ${contact.name}`);
    
    // Update usage stats in background
    if (amount && nativePrice) {
      const amountUSD = amount * (await convertUSD(amount)) / amount;
      contactsService.incrementUsage(contact.address, contact.chain, amountUSD).catch(err => 
        logger.warn('Failed to update contact usage:', err)
      );
    }
  };

  const resetModal = () => {
    setMode('method');
    setPaymentMethod(null);
    setSelectedAmount(null);
    setCustomAmount('');
    setRecipientAddress('');
    setScannedAddress('');
    setScannedAmount('');
    setLightningQR('');
    setLightningInvoice('');
    setLightningAction(null);
    setLightningInvoiceInput('');
    setShowSuccess(false);
    setParsedQR(null);
    setNeedsChainSwitch(false);
    setCryptoUSDValue(null);
    setCryptoAmount('');
    setNativePrice(0);
    setEstimatedGas(0);
    setEstimatedGasUSD(0);
    setError('');
    setTxHash('');
    setBalanceWarning(null);
    setPendingChainSwitch(null);
    setStep('idle'); // ✅ Reset to idle state
    stopCamera();
    
    // Stop payment monitoring
    if (paymentMonitorInterval) {
      clearInterval(paymentMonitorInterval);
      setPaymentMonitorInterval(null);
    }
  };

  const handleBack = () => {
    if (mode === 'amount') {
      setMode('method');
      setPaymentMethod(null);
    } else if (mode === 'address') {
      setMode('amount');
    } else if (mode === 'chain-switch') {
      // Go back to scan or method
      setParsedQR(null);
      setNeedsChainSwitch(false);
      setMode('method');
    } else if (mode === 'confirm') {
      if (paymentMethod === 'scanqr') {
        setMode('method');
      } else {
        setMode('address');
      }
      setScannedAddress('');
      setScannedAmount('');
      setParsedQR(null);
    } else if (mode === 'lightning-send' || mode === 'lightning-receive') {
      // Go back to lightning choice
      setMode('lightning');
      setLightningAction(null);
      setLightningInvoiceInput('');
      setLightningQR('');
      setLightningInvoice('');
    } else if (mode === 'lightning') {
      setMode('method');
      setPaymentMethod(null);
      setLightningAction(null);
    } else if (mode === 'scan') {
      stopCamera();
      setMode('method');
      setPaymentMethod(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
        >
          <div className="max-w-4xl mx-auto p-6">
            {/* Back Button */}
            <button
              onClick={() => {
                if (mode === 'method' || mode === 'processing' || mode === 'success') {
                  onClose();
                } else {
                  handleBack();
                }
              }}
              className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              ← {mode === 'method' || mode === 'processing' || mode === 'success' ? 'Close' : 'Back'}
            </button>

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Quick Pay</h2>
                  <p className="text-sm text-gray-600">
                    {mode === 'method' && 'Choose payment method'}
                    {mode === 'amount' && 'Step 1 of 2: Enter amount'}
                    {mode === 'address' && 'Step 2 of 2: Enter address'}
                    {mode === 'scan' && 'Scan QR code'}
                    {mode === 'lightning' && 'Lightning Network'}
                    {mode === 'lightning-send' && 'Pay Lightning invoice'}
                    {mode === 'lightning-receive' && 'Receive Lightning payment'}
                    {mode === 'chain-switch' && 'Switch network'}
                    {mode === 'confirm' && 'Review payment'}
                    {mode === 'processing' && 'Processing...'}
                    {mode === 'success' && 'Payment successful'}
                    {!['method', 'amount', 'address', 'scan', 'lightning', 'lightning-send', 'lightning-receive', 'chain-switch', 'confirm', 'processing', 'success'].includes(mode) && 'Fast and easy payments'}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="max-w-2xl mx-auto space-y-6">

            {/* ⚡ CHAIN SWITCH DIALOG - User-friendly prompt for chain switching */}
            {showChainSwitchDialog && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowChainSwitchDialog(false)}
              >
                <motion.div
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="glass-card p-6 max-w-md w-full"
                >
                  {/* Icon */}
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    {pendingChainSwitch ? (
                      <RefreshCw className="w-8 h-8 text-white" />
                    ) : (
                    <Zap className="w-8 h-8 text-white" />
                    )}
                  </div>

                  {/* Title & Message */}
                  {pendingChainSwitch ? (
                    <>
                      <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">
                        Switch Network
                      </h3>
                      <p className="text-center text-gray-700 mb-1 leading-relaxed">
                        This address is for <span className="font-semibold text-orange-600 capitalize">{pendingChainSwitch.to}</span>.
                      </p>
                      <p className="text-center text-gray-600 text-sm mb-6">
                        Switch from {pendingChainSwitch.from} to {pendingChainSwitch.to}?
                      </p>
                    </>
                  ) : (
                    <>
                  <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">
                    ⚡ Lightning Network
                  </h3>
                  <p className="text-center text-gray-700 mb-1 leading-relaxed">
                    Lightning runs on the <span className="font-semibold text-orange-600">Bitcoin network</span>.
                  </p>
                  <p className="text-center text-gray-600 text-sm mb-6">
                    Switch to Bitcoin to use instant, low-fee Lightning payments?
                  </p>
                    </>
                  )}

                  {/* Benefits (Lightning only) */}
                  {!pendingChainSwitch && (
                  <div className="bg-purple-50 border border-orange-200 rounded-xl p-4 mb-6">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-purple-900">
                        <Zap className="w-4 h-4 flex-shrink-0" />
                        <span><strong>Instant</strong> settlement (&lt; 1 second)</span>
                      </div>
                      <div className="flex items-center gap-2 text-purple-900">
                        <Check className="w-4 h-4 flex-shrink-0" />
                        <span><strong>Ultra-low</strong> fees (~$0.001)</span>
                      </div>
                      <div className="flex items-center gap-2 text-purple-900">
                        <Check className="w-4 h-4 flex-shrink-0" />
                        <span><strong>Perfect</strong> for small payments</span>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Current chain indicator */}
                  <div className="text-center text-xs text-gray-500 mb-4">
                    Currently on: <span className="font-semibold capitalize">{currentChain}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowChainSwitchDialog(false);
                        setPendingChainSwitch(null);
                      }}
                      className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleChainSwitch}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      {pendingChainSwitch ? `Switch to ${pendingChainSwitch.to}` : 'Yes, switch to Bitcoin'}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* STEP 1: METHOD SELECTION */}
            {mode === 'method' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose payment method</h3>
                    <p className="text-sm text-gray-600">Select how you want to pay or receive</p>
                  </div>

                  {/* Scan QR Code */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleMethodSelect('scanqr')}
                    className="w-full glass-card p-5 hover:bg-white/10 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Camera className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-semibold text-gray-900 text-base mb-0.5">Scan QR Code</div>
                        <div className="text-sm text-gray-600">Scan merchant payment QR → Instant payment</div>
                        </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors flex-shrink-0" />
                    </div>
                  </motion.button>

                  {/* Send to Address */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleMethodSelect('manual')}
                    className="w-full glass-card p-5 hover:bg-white/10 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <CreditCard className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-semibold text-gray-900 text-base mb-0.5">Send to address</div>
                        <div className="text-sm text-gray-600">Enter amount & wallet address → Manual transfer</div>
                        </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-rose-500 transition-colors flex-shrink-0" />
                    </div>
                  </motion.button>

                  {/* Lightning Payment */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleMethodSelect('lightning')}
                    className="w-full glass-card p-5 hover:bg-white/10 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Zap className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-semibold text-gray-900 text-base mb-0.5">Lightning payment</div>
                        <div className="text-sm text-gray-600">Generate Lightning invoice → Receive crypto</div>
                        </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors flex-shrink-0" />
                    </div>
                  </motion.button>
                </motion.div>
              )}

            {/* STEP 2: AMOUNT SELECTION (for manual & lightning) */}
            {mode === 'amount' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {/* ✅ Industry Standard Token Selector - Compact Dropdown with Search */}
                  {paymentMethod === 'manual' && (
                    <div className="relative" ref={tokenDropdownRef}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select token to send
                      </label>
                      
                      {isFetchingTokens ? (
                        <div className="glass-card p-4 flex items-center justify-center gap-3">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                          <span className="text-gray-600">Loading tokens...</span>
                        </div>
                      ) : (
                        <>
                          {/* Compact Token Selector Button */}
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setShowTokenDropdown(!showTokenDropdown);
                              if (!showTokenDropdown) {
                                setTokenSearchQuery('');
                              }
                            }}
                            className="w-full glass-card p-4 flex items-center justify-between gap-3 hover:bg-white/70 transition-all border-2 border-gray-200 hover:border-orange-300 rounded-xl"
                          >
                            {selectedToken ? (
                              <>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* Token Icon */}
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-gray-100">
                                    {selectedToken.logo ? (
                                      <img src={selectedToken.logo} alt={selectedToken.symbol} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-gray-700 font-bold text-sm">{selectedToken.symbol.slice(0, 2)}</span>
                                    )}
                                  </div>
                                  
                                  {/* Token Info */}
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-gray-900">{selectedToken.symbol}</span>
                                      {selectedToken.address === 'native' && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700 rounded flex-shrink-0">
                                          NATIVE
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                      {parseFloat(selectedToken.balance || '0').toLocaleString('en-US', { 
                                        minimumFractionDigits: 2, 
                                        maximumFractionDigits: 6 
                                      })} {selectedToken.symbol}
                                      {selectedToken.priceUSD && selectedToken.priceUSD > 0 && (
                                        <span className="ml-1">• {formatUSDSync(parseFloat(selectedToken.balanceUSD || '0'))}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Chevron */}
                                <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${showTokenDropdown ? 'rotate-180' : ''}`} />
                              </>
                            ) : (
                              <div className="w-full flex items-center justify-between">
                                <span className="text-gray-500">Select a token</span>
                                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showTokenDropdown ? 'rotate-180' : ''}`} />
                              </div>
                            )}
                          </motion.button>

                          {/* Dropdown Modal with Search */}
                          <AnimatePresence>
                            {showTokenDropdown && (
                              <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-xl shadow-2xl border-2 border-gray-200 overflow-hidden"
                              >
                                {/* Search Bar */}
                                <div className="p-3 border-b border-gray-200 bg-gray-50">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                      type="text"
                                      placeholder="Search tokens..."
                                      value={tokenSearchQuery}
                                      onChange={(e) => setTokenSearchQuery(e.target.value)}
                                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                                      autoFocus
                                    />
                                  </div>
                                </div>

                                {/* Token List */}
                                <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                  {(() => {
                                    // Filter tokens based on search query
                                    const filteredTokens = availableTokens.filter(token => {
                                      if (!tokenSearchQuery.trim()) return true;
                                      const query = tokenSearchQuery.toLowerCase();
                                      return (
                                        token.symbol.toLowerCase().includes(query) ||
                                        token.name?.toLowerCase().includes(query) ||
                                        token.address?.toLowerCase().includes(query)
                                      );
                                    });

                                    if (filteredTokens.length === 0) {
                                      return (
                                        <div className="p-8 text-center">
                                          <p className="text-gray-500 text-sm">No tokens found</p>
                                        </div>
                                      );
                                    }

                                    return filteredTokens.map((token) => {
                                      const isSelected = selectedToken?.symbol === token.symbol;
                                      return (
                                        <motion.button
                                          key={token.symbol}
                                          whileTap={{ scale: 0.98 }}
                                          onClick={() => {
                                            setSelectedToken(token);
                                            setShowTokenDropdown(false);
                                            setTokenSearchQuery('');
                                          }}
                                          className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-all border-b border-gray-100 last:border-b-0 ${
                                            isSelected ? 'bg-orange-50/50' : ''
                                          }`}
                                        >
                                          {/* Token Icon */}
                                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-gray-100">
                                            {token.logo ? (
                                              <img src={token.logo} alt={token.symbol} className="w-full h-full object-cover" />
                                            ) : (
                                              <span className="text-gray-700 font-bold text-sm">{token.symbol.slice(0, 2)}</span>
                                            )}
                                          </div>

                                          {/* Token Info */}
                                          <div className="flex-1 text-left min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className="font-semibold text-gray-900">{token.symbol}</span>
                                              {token.address === 'native' && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700 rounded flex-shrink-0">
                                                  NATIVE
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">
                                              {parseFloat(token.balance || '0').toLocaleString('en-US', { 
                                                minimumFractionDigits: 2, 
                                                maximumFractionDigits: 6 
                                              })} {token.symbol}
                                            </div>
                                          </div>

                                          {/* Token Value */}
                                          <div className="text-right flex-shrink-0">
                                            {token.priceUSD && token.priceUSD > 0 ? (
                                              <div className="text-sm font-semibold text-gray-900">
                                                {formatUSDSync(parseFloat(token.balanceUSD || '0'))}
                                              </div>
                                            ) : (
                                              <div className="text-sm font-semibold text-gray-900">
                                                {parseFloat(token.balance || '0').toFixed(4)}
                                              </div>
                                            )}
                                          </div>

                                          {/* Selected Checkmark */}
                                          {isSelected && (
                                            <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                                              <Check className="w-3 h-3 text-white" />
                                            </div>
                                          )}
                                        </motion.button>
                                      );
                                    });
                                  })()}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {paymentMethod === 'lightning' ? 'Amount to receive' : 'Amount to send'}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">Choose a preset or enter custom amount</p>
                    
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {PRESET_AMOUNTS_EUR.map((amt) => (
                        <motion.button
                          key={amt}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setSelectedAmount(amt);
                            setCustomAmount(amt.toString()); // ✅ Show preset in custom field too
                          }}
                          className={`p-6 text-center rounded-xl transition-all border-2 ${
                            selectedAmount === amt
                              ? 'bg-gradient-to-br from-orange-500 to-yellow-500 text-white border-orange-500 shadow-lg'
                              : 'bg-white border-gray-200 hover:border-orange-300 text-gray-900'
                          }`}
                        >
                          <div className="text-3xl font-bold">{symbol}{amt}</div>
                        </motion.button>
                      ))}
                    </div>

                    <div>
                      <h3 className="text-sm text-gray-600 mb-2">Or enter custom amount</h3>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-600">
                          {symbol}
                        </span>
                        <input aria-label="Number input"
                          type="number"
                          value={customAmount}
                          onChange={(e) => {
                            setCustomAmount(e.target.value);
                            setSelectedAmount(null);
                          }}
                          placeholder="0.00"
                          className="w-full pl-12 pr-4 py-4 text-2xl font-bold input-field placeholder-gray-400"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAmountNext}
                    disabled={!amount || amount <= 0 || isConverting}
                    className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 flex items-center justify-center gap-2"
                  >
                    {isConverting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      'Next →'
                    )}
                  </button>
                </motion.div>
              )}

            {/* STEP 3: ADDRESS INPUT (for manual only) */}
            {mode === 'address' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {/* Crypto Preview Card */}
                  <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">You're sending</div>
                        <div className="text-3xl font-bold text-gray-900">{symbol}{amount.toFixed(2)}</div>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                        <ArrowUpRight className="w-6 h-6 text-white" />
                      </div>
                  </div>

                    {/* Crypto Amount Display */}
                    <div className="bg-white/60 backdrop-blur rounded-xl p-4 border border-orange-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Crypto amount</span>
                        <span className="text-lg font-bold text-gray-900">
                          {(() => {
                            const tokenSymbol = selectedToken?.symbol || CHAINS[currentChain].nativeCurrency.symbol;
                            console.log('🔍 [QuickPay Address Screen] Rendering crypto amount:', {
                              selectedToken,
                              tokenSymbol,
                              cryptoAmount,
                              fallback: CHAINS[currentChain].nativeCurrency.symbol
                            });
                            return `${parseFloat(cryptoAmount).toFixed(6)} ${tokenSymbol}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Est. gas fee</span>
                        <span>{estimatedGas.toFixed(6)} {CHAINS[currentChain].nativeCurrency.symbol} ({formatUSDSync(estimatedGasUSD)})</span>
                      </div>
                    </div>
                  </div>

                  {/* Recipient Address Input */}
                  <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-2">
                      Recipient wallet address
                    </label>
                    <p className="text-sm text-gray-600 mb-3">
                      Enter a valid {CHAINS[currentChain].name} address
                    </p>
                    <textarea
                      value={recipientAddress}
                      onChange={(e) => {
                        setRecipientAddress(e.target.value);
                        setError(''); // Clear error on input
                      }}
                      placeholder={`Enter ${CHAINS[currentChain].name} address...`}
                      rows={3}
                      className={`w-full input-field font-mono text-sm resize-none transition-all ${
                        error ? 'border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    
                    {/* Error Message */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 flex items-start gap-2 text-red-600 text-sm"
                      >
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </motion.div>
                    )}
                    
                    {/* Balance Warning */}
                    {balanceWarning && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold text-red-900 text-sm">{balanceWarning.message}</p>
                            <div className="mt-2 space-y-1 text-xs text-red-700">
                              <div className="flex justify-between">
                                <span>You need:</span>
                                <span className="font-mono font-semibold">{balanceWarning.details.need}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>You have:</span>
                                <span className="font-mono font-semibold">{balanceWarning.details.have}</span>
                              </div>
                              <div className="flex justify-between border-t border-red-200 pt-1 mt-1">
                                <span>Missing:</span>
                                <span className="font-mono font-semibold">{balanceWarning.details.missing} ({balanceWarning.details.missingUSD})</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Quick Options */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick options</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handlePasteAddress}
                        className="p-3 bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl text-center transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                      >
                        <Copy className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-gray-900">Paste</div>
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setMode('scan');
                        }}
                        className="p-3 bg-white border-2 border-gray-200 hover:border-green-300 rounded-xl text-center transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                      >
                        <Camera className="w-5 h-5 text-green-600 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-gray-900">Scan QR</div>
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowContactsModal(true)}
                        className="p-3 bg-white border-2 border-gray-200 hover:border-orange-300 rounded-xl text-center transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                      >
                        <User className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-gray-900">Contacts</div>
                      </motion.button>
                    </div>
                  </div>

                  {/* Action Button */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddressNext}
                    disabled={!recipientAddress || recipientAddress.length < 26}
                    className="w-full py-4 px-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 flex items-center justify-center gap-2"
                  >
                    <span>Review payment</span>
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </motion.div>
              )}

            {/* QR SCANNER */}
            {mode === 'scan' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {scanning && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-64 h-64 border-4 border-orange-500 rounded-2xl relative">
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500" />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500" />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500" />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500" />
                          
                          <motion.div
                            className="absolute left-0 right-0 h-1 bg-orange-500 shadow-lg shadow-orange-500/50"
                            animate={{ top: ['0%', '100%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {cameraError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 p-6">
                        <div className="text-center">
                          <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <div className="text-white font-semibold mb-2">Camera access required</div>
                          <div className="text-sm text-gray-400 mb-4">{cameraError}</div>
                          <button
                            onClick={startCamera}
                            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                          >
                            Try again
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {!scanning && !cameraError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
                        <div className="text-center">
                          <Scan className="w-16 h-16 text-green-500 mx-auto mb-4 animate-pulse" />
                          <div className="text-lg font-semibold text-gray-900 mb-2">Starting camera...</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                    <div className="text-sm text-gray-700 font-medium mb-3 flex items-center gap-2">
                      <Camera className="w-5 h-5 text-green-600" />
                      <span>Scanning Tips</span>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>Hold camera steady over the QR code</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>Ensure good lighting for best results</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <span>Supports: Ethereum, Solana, Bitcoin QR codes</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            {/* ✅ NEW: CHAIN SWITCH MODAL */}
            {mode === 'chain-switch' && parsedQR && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <RefreshCw className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Switch to {QRParser.getChainInfo(parsedQR.chain)?.name}?
                    </h3>
                    <p className="text-sm text-gray-600">This QR code is for a different blockchain</p>
                  </div>

                  {/* Current vs Detected Chain */}
                  <div className="glass-card p-5 space-y-4">
                    {/* Current Chain */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-lg">{QRParser.getChainInfo(currentChain as ChainType)?.icon || '?'}</span>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Current chain</div>
                          <div className="font-semibold text-gray-900">
                            {QRParser.getChainInfo(currentChain as ChainType)?.name || currentChain}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600">
                        Active
                      </div>
                    </div>

                    <div className="h-px bg-gray-200" />

                    {/* Detected Chain */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                          style={{ 
                            background: `linear-gradient(to bottom right, ${QRParser.getChainInfo(parsedQR.chain)?.color || '#666'}, ${QRParser.getChainInfo(parsedQR.chain)?.color || '#666'})` 
                          }}
                        >
                          <span className="text-lg text-white">{QRParser.getChainInfo(parsedQR.chain)?.icon || '?'}</span>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Detected chain</div>
                          <div className="font-semibold text-gray-900">
                            {QRParser.getChainInfo(parsedQR.chain)?.name || parsedQR.chain}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                        {parsedQR.confidence === 'high' ? '✓ High confidence' : parsedQR.confidence === 'medium' ? 'Medium' : 'Low'}
                      </div>
                    </div>
                  </div>

                  {/* QR Details */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-start text-sm">
                      <span className="text-gray-600">Address:</span>
                      <span className="font-mono text-gray-900 text-right break-all">
                        {parsedQR.address.substring(0, 8)}...{parsedQR.address.substring(parsedQR.address.length - 6)}
                      </span>
                    </div>
                    {parsedQR.amount && (
                      <div className="flex justify-between items-start text-sm">
                        <span className="text-gray-600">Amount:</span>
                        <span className="font-medium text-gray-900">
                          {parsedQR.amount} {QRParser.getChainInfo(parsedQR.chain)?.symbol}
                        </span>
                      </div>
                    )}
                    {parsedQR.label && (
                      <div className="flex justify-between items-start text-sm">
                        <span className="text-gray-600">Label:</span>
                        <span className="text-gray-900">{parsedQR.label}</span>
                      </div>
                    )}
                  </div>

                  {/* Warning if needed */}
                  {parsedQR.warnings && parsedQR.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-gray-700">
                          {parsedQR.warnings.map((warning, idx) => (
                            <div key={idx}>{warning}</div>
                          ))}
                    </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setParsedQR(null);
                        setNeedsChainSwitch(false);
                        setMode('method');
                      }}
                      className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        // Switch chain and proceed to confirm
                        logger.log(`🔄 [QuickPay] Switching chain: ${currentChain} → ${parsedQR.chain}`);
                        switchChain(parsedQR.chain);
                        setScannedAddress(parsedQR.address);
                        setScannedAmount(parsedQR.amount || '');
                        setNeedsChainSwitch(false);
                        setMode('confirm');
                      }}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Switch & Continue
                    </button>
                  </div>
                </motion.div>
              )}

            {/* LIGHTNING QR DISPLAY */}
            {/* ⚡ LIGHTNING NETWORK - Choose Send or Receive */}
            {mode === 'lightning' && !lightningAction && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Lightning Header */}
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Zap className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      ⚡ Lightning Network
                    </h3>
                    <p className="text-sm text-gray-600">
                      Instant Bitcoin payments • Ultra-low fees
                    </p>
                  </div>

                  {/* 📱 MOBILE NOTICE */}
                  {/* Mobile Notice - Only show on mobile web (not native apps) */}
                  {isMobile && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 mb-2">
                            ⚡ Lightning on Mobile
                          </h4>
                          <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                            For Lightning payments on mobile, install{' '}
                            <a 
                              href="https://getalby.com/products/alby-go" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 underline font-semibold"
                            >
                              Alby Go
                            </a>
                            {' '}and open Blaze Wallet from within the app.
                          </p>
                          <div className="bg-white/80 rounded-lg p-3">
                            <p className="text-xs text-gray-600">
                              <strong>On desktop?</strong> Use the{' '}
                              <a 
                                href="https://getalby.com" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 underline font-semibold"
                              >
                                Alby browser extension
                              </a>
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Benefits Card */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-orange-200 rounded-xl p-5">
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">Instant settlement</div>
                          <div className="text-xs text-gray-600">Payments arrive in less than a second</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">Ultra-low fees</div>
                          <div className="text-xs text-gray-600">Typically less than $0.001 per transaction</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">Perfect for small payments</div>
                          <div className="text-xs text-gray-600">Great for everyday transactions</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {/* Send Lightning Payment */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setLightningAction('send');
                        setMode('lightning-send');
                      }}
                      className="w-full p-6 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl text-white transition-all shadow-lg group relative overflow-hidden"
                    >
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <ArrowUpRight className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <div className="text-lg font-bold">Send Lightning Payment</div>
                            <div className="text-sm text-white/80">Pay a BOLT11 invoice</div>
                          </div>
                        </div>
                        <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.button>

                    {/* Receive Lightning Payment */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setLightningAction('receive');
                        setMode('lightning-receive');
                      }}
                      className="w-full p-6 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-purple-600 hover:to-pink-600 rounded-xl text-white transition-all shadow-lg group relative overflow-hidden"
                    >
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <ArrowDownLeft className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <div className="text-lg font-bold">Receive Lightning Payment</div>
                            <div className="text-sm text-white/80">Generate payment invoice</div>
                          </div>
                        </div>
                        <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.button>
                  </div>

                  {/* Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-gray-700">
                        <strong>New to Lightning?</strong> It's a second-layer payment protocol that operates on top of Bitcoin for instant, low-fee transactions.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            {/* ⚡ LIGHTNING SEND - Pay invoice */}
            {mode === 'lightning-send' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Zap className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Pay Lightning Invoice
                    </h3>
                    <p className="text-sm text-gray-600">Enter or scan a BOLT11 invoice</p>
                  </div>

                  {/* Invoice Input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Lightning Invoice (BOLT11)
                    </label>
                    <textarea
                      value={lightningInvoiceInput}
                      onChange={(e) => setLightningInvoiceInput(e.target.value)}
                      placeholder="lnbc... or lightning:lnbc..."
                      rows={4}
                      className="w-full input-field font-mono text-sm resize-none"
                    />
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text && (text.startsWith('lnbc') || text.startsWith('lightning:'))) {
                            setLightningInvoiceInput(text);
                          } else {
                            toast.error('❌ No Lightning invoice found in clipboard');
                          }
                        } catch (error) {
                          toast('Could not access clipboard. Please paste manually.');
                        }
                      }}
                      className="p-4 bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl text-center transition-all"
                    >
                      <Copy className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                      <div className="text-sm font-semibold text-gray-900">Paste Invoice</div>
                    </button>
                    <button
                      onClick={() => {
                        setMode('scan');
                        // Scanner will detect Lightning invoices
                      }}
                      className="p-4 bg-white border-2 border-gray-200 hover:border-green-300 rounded-xl text-center transition-all"
                    >
                      <Camera className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <div className="text-sm font-semibold text-gray-900">Scan QR</div>
                    </button>
                  </div>

                  {/* Pay Button */}
                  <button
                    onClick={async () => {
                      if (!lightningInvoiceInput || (!lightningInvoiceInput.startsWith('lnbc') && !lightningInvoiceInput.startsWith('lightning:'))) {
                        toast.error('❌ Please enter a valid Lightning invoice (starts with lnbc...)');
                        return;
                      }
                      
                      try {
                        // Validate invoice first
                        const validation = lightningService.validateInvoice(lightningInvoiceInput);
                        if (!validation.valid) {
                          toast.error(`❌ Invalid invoice: ${validation.error}`);
                          return;
                        }

                        // Show decoded invoice details
                        if (validation.decoded) {
                          const confirmMsg = `⚡ Pay Lightning Invoice?\n\n` +
                            `Amount: ${validation.decoded.amountSats} sats\n` +
                            `Description: ${validation.decoded.description}\n` +
                            `Destination: ${validation.decoded.destination.substring(0, 20)}...`;
                          
                          if (!confirm(confirmMsg)) {
                            return;
                          }
                        }

                        setMode('processing');
                        
                        // Pay invoice via Lightning service
                        const payment = await lightningService.payInvoice(lightningInvoiceInput);
                        
                        if (payment.success) {
                          logger.log('✅ Lightning payment successful!', payment);
                          setMode('success');
                          setShowSuccess(true);
                          setTimeout(() => {
                            onClose();
                            resetModal();
                          }, 3000);
                        } else {
                          setMode('lightning-send');
                          toast.error(`❌ Payment failed: ${payment.error}`);
                        }
                      } catch (error: any) {
                        logger.error('❌ Lightning payment error:', error);
                        setMode('lightning-send');
                        toast.error(`❌ Payment failed: ${error.message || 'Unknown error'}`);
                      }
                    }}
                    disabled={!lightningInvoiceInput}
                    className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  >
                    Pay Invoice ⚡
                  </button>

                  {/* Info */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-gray-700">
                        <strong>Instant payment:</strong> Lightning invoices are paid instantly with extremely low fees (typically &lt; $0.001).
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            {/* ⚡ LIGHTNING RECEIVE - Generate invoice */}
            {mode === 'lightning-receive' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {!lightningQR ? (
                    <>
                      {/* Amount Input */}
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <ArrowDownLeft className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          Receive Lightning Payment
                        </h3>
                        <p className="text-sm text-gray-600">Set amount to receive</p>
                      </div>

                      {/* Preset Amounts */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">Select amount ({selectedCurrency})</label>
                        <div className="grid grid-cols-5 gap-2">
                          {PRESET_AMOUNTS_EUR.map((preset) => (
                            <button
                              key={preset}
                              onClick={() => {
                                setSelectedAmount(preset);
                                setCustomAmount(preset.toString()); // ✅ Show preset in custom field too
                              }}
                              className={`py-3 rounded-lg font-semibold transition-all ${
                                selectedAmount === preset
                                  ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg'
                                  : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-orange-300'
                              }`}
                            >
                              {symbol}{preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Amount */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Or enter custom amount</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-500">
                            {symbol}
                          </div>
                          <input aria-label="Number input"
                            type="number"
                            value={customAmount}
                            onChange={(e) => {
                              setCustomAmount(e.target.value);
                              setSelectedAmount(null);
                            }}
                            placeholder="0.00"
                            className="w-full pl-12 pr-4 py-4 text-2xl font-bold input-field placeholder-gray-400"
                          />
                        </div>
                      </div>

                      {/* Generate Invoice Button */}
                      <button
                        onClick={async () => {
                          if (!amount || amount <= 0) {
                            toast.error('❌ Please enter a valid amount');
                            return;
                          }

                          try {
                            // Convert user's currency to USD, then to BTC/sats
                            const amountUSD = await convertUSD(amount);
                            // Assume 1 USD = ~2000 sats (this should use real-time price)
                            const amountSats = Math.floor(amountUSD * 2000);
                            
                            logger.log(`⚡ Generating Lightning invoice for ${symbol}${amount} (${amountSats} sats)...`);

                            // Create invoice via Lightning service
                            const invoice = await lightningService.createInvoice(
                              amountSats,
                              `Blaze Wallet: ${symbol}${amount}`
                            );

                            if (!invoice) {
                              throw new Error('Failed to create invoice');
                            }

                            logger.log('✅ Invoice created:', invoice.substring(0, 40) + '...');
                            setLightningInvoice(invoice);

                            // Generate QR code
                            const qr = await QRCode.toDataURL(invoice, {
                              width: 400,
                              margin: 2,
                              color: {
                                dark: '#9333ea', // Purple
                                light: '#FFFFFF',
                              },
                            });
                            setLightningQR(qr);

                            // Extract payment hash from invoice for monitoring
                            const decoded = lightningService.decodeInvoice(invoice);
                            if (decoded) {
                              startPaymentMonitoring(decoded.paymentHash);
                            }
                          } catch (error: any) {
                            logger.error('❌ Failed to generate invoice:', error);
                            
                            // User-friendly error messages
                            if (error.message?.includes('WebLN not available')) {
                              // Show helpful modal with instructions
                              const userAgent = navigator.userAgent.toLowerCase();
                              const isMobile = /iphone|ipad|android/.test(userAgent);
                              
                              if (isMobile) {
                                alert(
                                  '⚡ Lightning Setup Required\n\n' +
                                  'To receive Lightning payments on mobile:\n\n' +
                                  '📱 Option 1: Install Alby Go\n' +
                                  '   → Download from App Store/Play Store\n' +
                                  '   → Open Blaze Wallet in Alby Go browser\n\n' +
                                  '📱 Option 2: Install Zeus Wallet\n' +
                                  '   → Download Zeus app\n' +
                                  '   → Use WebLN feature\n\n' +
                                  '💡 Or wait for native Blaze Wallet app with built-in Lightning!'
                                );
                              } else {
                                alert(
                                  '⚡ Lightning Wallet Required\n\n' +
                                  'To receive Lightning payments, install a Lightning wallet:\n\n' +
                                  '🐝 Recommended: Alby\n' +
                                  '   → Visit: getalby.com\n' +
                                  '   → Install browser extension\n' +
                                  '   → Reload this page\n\n' +
                                  '⚡ Alternative: Zeus\n' +
                                  '   → Visit: zeusln.com\n\n' +
                                  '💡 Setup takes just 2 minutes!'
                                );
                              }
                            } else {
                              toast.error(`❌ Failed to generate invoice: ${error.message || 'Unknown error'}`);
                            }
                          }
                        }}
                        disabled={!amount || amount <= 0}
                        className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                      >
                        Generate Invoice ⚡
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Invoice Generated - Show QR */}
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-2">Receive</div>
                    <div className="text-4xl font-bold text-gray-900 mb-2">€{amount.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Lightning Network Payment</div>
                  </div>

                      {/* QR Code */}
                    <div className="bg-white border-2 border-orange-200 rounded-xl p-6">
                      <div className="mb-4 text-sm text-gray-600 text-center">
                        Scan with Lightning wallet to pay
                      </div>
                      <img 
                        src={lightningQR} 
                        alt="Lightning Invoice QR" 
                        className="w-64 max-w-[70vw] aspect-square h-auto mx-auto rounded-xl object-contain"
                      />
                        
                        {/* Invoice String */}
                      <div className="mt-4 p-3 bg-purple-50 border border-orange-200 rounded-lg">
                          <div className="text-xs text-gray-600 mb-1 text-center font-semibold">
                            BOLT11 Invoice
                          </div>
                          <div className="text-xs font-mono break-all text-gray-900 text-center mb-3">
                            {lightningInvoice.substring(0, 40)}...
                        </div>
                        <button
                          onClick={() => {
                              navigator.clipboard.writeText(lightningInvoice);
                              toast('✅ Invoice copied to clipboard!');
                          }}
                            className="w-full py-2 rounded-lg bg-white border border-orange-300 hover:bg-purple-50 text-purple-700 font-semibold text-sm transition-colors"
                        >
                          <Copy className="w-4 h-4 inline mr-2" />
                          Copy invoice
                        </button>
                      </div>
                    </div>

                      {/* Status */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-orange-600" />
                          <div className="text-sm font-semibold text-gray-900">Awaiting payment...</div>
                    </div>
                      <div className="text-xs text-gray-600">⏱️ Expires in 14:52</div>
                    </div>

                      {/* New Invoice Button */}
                      <button
                        onClick={() => {
                          setLightningQR('');
                          setLightningInvoice('');
                        }}
                        className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold transition-colors"
                      >
                        Generate New Invoice
                      </button>
                    </>
                  )}
                  </motion.div>
              )}

            {/* CONFIRMATION SCREEN */}
            {mode === 'confirm' && (scannedAddress || recipientAddress) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {paymentMethod === 'scanqr' ? 'QR code scanned!' : 'Review payment'}
                    </h3>
                    <p className="text-sm text-gray-600">Review payment details below</p>
                  </div>

                  {/* 🆕 LABEL & MESSAGE from QR code */}
                  {parsedQR && (parsedQR.label || parsedQR.message) && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
                      {parsedQR.label && (
                        <div className="mb-3">
                          <div className="text-xs text-blue-600 font-semibold mb-1">Recipient</div>
                          <div className="text-lg font-bold text-gray-900">{parsedQR.label}</div>
                        </div>
                      )}
                      {parsedQR.message && (
                        <div>
                          <div className="text-xs text-blue-600 font-semibold mb-1">Description</div>
                          <div className="text-sm text-gray-700">{parsedQR.message}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ⚠️ AMOUNT WARNING - QR amount is in native crypto! */}
                  {scannedAmount && parsedQR?.amount && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <div className="font-bold text-red-900 mb-1">Amount from QR code</div>
                          <div className="text-red-700">
                            The QR code specifies <strong>{scannedAmount} {QRParser.getChainInfo(currentChain as ChainType)?.symbol}</strong> (native cryptocurrency amount).
                            {currentChain === 'bitcoin' && parseFloat(scannedAmount) >= 0.01 && (
                              <span className="block mt-1 font-semibold">⚠️ This is a significant amount! Please verify.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Summary Card */}
                  <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-6">
                    <div className="text-sm text-gray-600 mb-2">You're sending</div>
                    {scannedAmount && parsedQR?.amount ? (
                      // Amount from QR code - show in native crypto
                      <>
                    <div className="text-4xl font-bold text-gray-900 mb-1">
                          {scannedAmount} {QRParser.getChainInfo(currentChain as ChainType)?.symbol}
                    </div>
                        <div className="text-sm text-gray-500">
                          Native {QRParser.getChainInfo(currentChain as ChainType)?.name} amount from QR code
                        </div>
                        {cryptoUSDValue !== null && (
                          <div className="text-lg text-gray-600 mt-2">
                            ≈ {formatUSDSync(cryptoUSDValue)}
                          </div>
                        )}
                      </>
                    ) : (
                      // Manual amount - show in user's currency + crypto
                      <>
                        <div className="text-4xl font-bold text-gray-900 mb-1">
                          {symbol}{amount.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600 flex items-center justify-center gap-2 mb-2">
                          <span>{QRParser.getChainInfo(currentChain as ChainType)?.icon || '?'}</span>
                          Via {QRParser.getChainInfo(currentChain as ChainType)?.name || currentChain} network
                        </div>
                        {/* Crypto equivalent */}
                        <div className="bg-white/60 backdrop-blur rounded-lg p-3 mt-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Crypto amount:</span>
                            <span className="font-mono font-bold text-gray-900">
                              {parseFloat(cryptoAmount).toFixed(6)} {selectedToken?.symbol || CHAINS[currentChain].nativeCurrency.symbol}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                            <span>Est. gas fee:</span>
                            <span className="font-mono">
                              {estimatedGas.toFixed(6)} {CHAINS[currentChain].nativeCurrency.symbol} ({formatUSDSync(estimatedGasUSD)})
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Recipient Details */}
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">To address</span>
                      <div className="text-right">
                        <div className="font-mono text-sm font-medium text-gray-900 break-all">
                          {(scannedAddress || recipientAddress).slice(0, 6)}...{(scannedAddress || recipientAddress).slice(-4)}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(scannedAddress || recipientAddress);
                            toast.success('Address copied!');
                          }}
                          className="text-xs text-orange-600 hover:text-orange-700 mt-1"
                        >
                          Copy full address
                        </button>
                      </div>
                    </div>
                    </div>
                    
                  {/* Error Display */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border-2 border-red-300 rounded-xl p-4"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-red-900 text-sm">{error}</p>
                    </div>
                  </div>
                    </motion.div>
                  )}

                  {/* Action Button */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                      onClick={handleConfirmPayment}
                    disabled={step === 'sending'}
                    className="w-full py-4 px-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {step === 'sending' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Sending transaction...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Confirm & Send</span>
                      </>
                    )}
                  </motion.button>

                  <p className="text-xs text-center text-gray-500">
                    Make sure the details are correct before confirming
                  </p>
                </motion.div>
              )}

            {/* PROCESSING */}
            {mode === 'processing' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <div className="text-lg font-semibold text-gray-900">Processing payment...</div>
                </div>
              )}

            {/* SUCCESS */}
            {mode === 'success' && (
                <div className="text-center py-12">
                  <ParticleEffect trigger={showSuccess} type="celebration" />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <Check className="w-12 h-12 text-green-500" />
                  </motion.div>
                  <div className="text-2xl font-bold text-gray-900 mb-2">Payment successful!</div>
                  <div className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
                    {scannedAmount && parsedQR?.amount ? (
                      `${scannedAmount} ${QRParser.getChainInfo(currentChain as ChainType)?.symbol}`
                    ) : (
                      `€${amount.toFixed(2)}`
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
      
      {/* 📇 Contacts Modal */}
      <ContactsModal
        isOpen={showContactsModal}
        onClose={() => setShowContactsModal(false)}
        onSelectContact={handleSelectContact}
        filterChain={currentChain}
      />

      {/* 🔐 2FA Verification Modal */}
      {userId && (
        <SensitiveAction2FAModal
          isOpen={show2FAModal}
          onClose={() => setShow2FAModal(false)}
          onSuccess={executePayment}
          userId={userId}
          actionName={`Send ${amount} ${symbol}`}
          actionType="send"
          amountUSD={pendingPaymentData?.sendValueUSD}
        />
      )}
    </AnimatePresence>
  );
}
