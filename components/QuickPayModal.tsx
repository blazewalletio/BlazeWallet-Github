'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, CreditCard, Scan, Check, Camera, AlertCircle, ArrowRight, Copy, User, RefreshCw } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import QRCode from 'qrcode';
import ParticleEffect from './ParticleEffect';
import jsQR from 'jsqr';
import { QRParser, ParsedQRData, ChainType } from '@/lib/qr-parser';

interface QuickPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMethod?: 'scanqr' | 'manual' | 'lightning'; // ⚡ NEW: Auto-select method
}

const PRESET_AMOUNTS_EUR = [5, 10, 20, 50, 100];

export default function QuickPayModal({ isOpen, onClose, initialMethod }: QuickPayModalProps) {
  // Main flow: 'method' | 'amount' | 'address' | 'scan' | 'chain-switch' | 'lightning' | 'confirm' | 'processing' | 'success'
  const [mode, setMode] = useState<'method' | 'amount' | 'address' | 'scan' | 'chain-switch' | 'lightning' | 'confirm' | 'processing' | 'success'>('method');
  const [paymentMethod, setPaymentMethod] = useState<'scanqr' | 'manual' | 'lightning' | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [lightningQR, setLightningQR] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedAddress, setScannedAddress] = useState<string>('');
  const [scannedAmount, setScannedAmount] = useState<string>('');
  
  // ✅ NEW: Chain detection and switching
  const [parsedQR, setParsedQR] = useState<ParsedQRData | null>(null);
  const [needsChainSwitch, setNeedsChainSwitch] = useState(false);
  const [showChainSwitchDialog, setShowChainSwitchDialog] = useState(false); // ⚡ NEW: Chain switch confirmation
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  
  const { address, currentChain, switchChain } = useWalletStore();

  // Block body scroll when overlay is open
  useBlockBodyScroll(isOpen);

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
      console.error('Camera error:', error);
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
      console.log('QR Code detected:', code.data);
      handleQRCodeDetected(code.data);
    }
  };

  const handleQRCodeDetected = (data: string) => {
    stopCamera();
    
    console.log('🔍 [QuickPay] QR code detected:', data);
    
    try {
      // ✅ Parse QR code using intelligent parser
      const parsed = QRParser.parse(data);
      setParsedQR(parsed);
      
      console.log('📋 [QuickPay] Parsed result:', {
        chain: parsed.chain,
        confidence: parsed.confidence,
        address: parsed.address.substring(0, 10) + '...',
        amount: parsed.amount,
        isValid: parsed.isValid,
      });
      
      // Check if QR is valid
      if (!parsed.isValid || parsed.chain === 'unknown') {
        alert(`❌ Invalid QR Code\n\n${parsed.warnings?.join('\n') || 'Could not recognize blockchain address.'}`);
        setMode('scan');
        startCamera();
        return;
      }
      
      // Check if chain switch is needed
      const detectedChain = parsed.chain;
      if (detectedChain !== currentChain && QRParser.isEVMChain(detectedChain)) {
        // EVM chains can be switched
        console.log(`🔄 [QuickPay] Chain switch needed: ${currentChain} → ${detectedChain}`);
        setNeedsChainSwitch(true);
        setMode('chain-switch');
      } else if (detectedChain !== currentChain && detectedChain === 'solana') {
        // Solana needs switch
        console.log(`🔄 [QuickPay] Chain switch needed: ${currentChain} → solana`);
        setNeedsChainSwitch(true);
        setMode('chain-switch');
      } else if (detectedChain !== currentChain && detectedChain === 'bitcoin') {
        // Bitcoin not supported yet
        alert(`⚠️ Bitcoin Not Supported\n\nBitcoin transactions are not yet available in Blaze Wallet.\n\nComing soon! 🚀`);
        setMode('scan');
        startCamera();
        return;
      } else {
        // Same chain - proceed directly to confirmation
        setScannedAddress(parsed.address);
        setScannedAmount(parsed.amount || '');
        setMode('confirm');
      }
    } catch (error) {
      console.error('❌ Error parsing QR code:', error);
      alert('Could not parse QR code. Please try again.');
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
        alert('Invalid wallet address QR code.');
        setMode('address');
      }
    } catch (error) {
      console.error('Error parsing address QR:', error);
      alert('Could not parse QR code.');
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
      console.error('Error generating QR:', error);
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
      setMode('amount');
    } else if (method === 'lightning') {
      setMode('lightning'); // ⚡ Go directly to Lightning flow
    }
  };

  // ⚡ NEW: Handle chain switch confirmation
  const handleChainSwitch = () => {
    switchChain('bitcoin');
    setShowChainSwitchDialog(false);
    setMode('lightning');
  };

  // ⚡ NEW: Auto-select method on open (must be after handleMethodSelect definition)
  useEffect(() => {
    if (isOpen && initialMethod) {
      handleMethodSelect(initialMethod);
    }
  }, [isOpen, initialMethod]);

  const handleAmountNext = () => {
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    if (paymentMethod === 'manual') {
      setMode('address');
    } else if (paymentMethod === 'lightning') {
      generateLightningQR();
    }
  };

  const handleAddressNext = () => {
    if (!recipientAddress || recipientAddress.length < 26) {
      alert('Please enter a valid wallet address');
      return;
    }
    
    setScannedAddress(recipientAddress);
    setScannedAmount(amount.toString());
    setMode('confirm');
  };

  const handleConfirmPayment = () => {
    setMode('processing');
    
    setTimeout(() => {
      setMode('success');
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
        resetModal();
      }, 3000);
    }, 1500);
  };

  const handlePasteAddress = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.length >= 26) {
        setRecipientAddress(text);
      } else {
        alert('Invalid address in clipboard');
      }
    } catch (error) {
      alert('Could not access clipboard. Please paste manually.');
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
    setShowSuccess(false);
    setParsedQR(null);
    setNeedsChainSwitch(false);
    stopCamera();
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
    } else if (mode === 'lightning') {
      setMode('method');
      setPaymentMethod(null);
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
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-500 to-yellow-500 px-4 sm:px-6 pt-safe">
            <div className="flex items-center justify-between py-4">
              <button
                onClick={() => {
                  if (mode === 'method' || mode === 'processing' || mode === 'success') {
                    onClose();
                  } else {
                    handleBack();
                  }
                }}
                className="flex items-center gap-2 text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
              >
                <ArrowRight className="w-5 h-5 rotate-180" />
                <span className="font-semibold">
                  {mode === 'method' || mode === 'processing' || mode === 'success' ? 'Close' : 'Back'}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-white" />
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white">Quick Pay</h2>
                  {mode === 'amount' && <p className="text-xs text-white/80">Step 1 of 2</p>}
                  {mode === 'address' && <p className="text-xs text-white/80">Step 2 of 2</p>}
                </div>
              </div>
              <div className="w-24" /> {/* Spacer for centering */}
            </div>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-6 pb-safe max-w-2xl mx-auto">

            {/* ⚡ CHAIN SWITCH DIALOG - User-friendly Lightning prompt */}
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
                  {/* Lightning Icon */}
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-white" />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">
                    ⚡ Lightning Network
                  </h3>

                  {/* Message */}
                  <p className="text-center text-gray-700 mb-1 leading-relaxed">
                    Lightning runs on the <span className="font-semibold text-orange-600">Bitcoin network</span>.
                  </p>
                  <p className="text-center text-gray-600 text-sm mb-6">
                    Switch to Bitcoin to use instant, low-fee Lightning payments?
                  </p>

                  {/* Benefits */}
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
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

                  {/* Current chain indicator */}
                  <div className="text-center text-xs text-gray-500 mb-4">
                    Currently on: <span className="font-semibold capitalize">{currentChain}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowChainSwitchDialog(false)}
                      className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Maybe later
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleChainSwitch}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      Yes, switch to Bitcoin
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
                    className="w-full glass p-5 rounded-xl hover:bg-theme-bg-secondary transition-all duration-200 group"
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
                    className="w-full glass p-5 rounded-xl hover:bg-theme-bg-secondary transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <CreditCard className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-semibold text-gray-900 text-base mb-0.5">Send to address</div>
                        <div className="text-sm text-gray-600">Enter amount & wallet address → Manual transfer</div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                    </div>
                  </motion.button>

                  {/* Lightning Payment */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleMethodSelect('lightning')}
                    className="w-full glass p-5 rounded-xl hover:bg-theme-bg-secondary transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
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
                            setCustomAmount('');
                          }}
                          className={`p-6 text-center rounded-xl transition-all border-2 ${
                            selectedAmount === amt
                              ? 'bg-gradient-to-br from-orange-500 to-yellow-500 text-white border-orange-500 shadow-lg'
                              : 'bg-white border-gray-200 hover:border-orange-300 text-gray-900'
                          }`}
                        >
                          <div className="text-3xl font-bold">€{amt}</div>
                        </motion.button>
                      ))}
                    </div>

                    <div>
                      <h3 className="text-sm text-gray-600 mb-2">Or enter custom amount</h3>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-600">
                          €
                        </span>
                        <input
                          type="number"
                          value={customAmount}
                          onChange={(e) => {
                            setCustomAmount(e.target.value);
                            setSelectedAmount(null);
                          }}
                          placeholder="0.00"
                          className="w-full pl-12 pr-4 py-4 text-2xl font-bold bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAmountNext}
                    disabled={!amount || amount <= 0}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next →
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
                  <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-4">
                    <div className="text-sm text-gray-600 mb-1">Sending</div>
                    <div className="text-3xl font-bold text-gray-900">€{amount.toFixed(2)}</div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Recipient wallet address</h3>
                    <textarea
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder="0x... or paste wallet address"
                      rows={3}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm resize-none"
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick options</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={handlePasteAddress}
                        className="p-3 bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl text-center transition-all"
                      >
                        <Copy className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-gray-900">Paste</div>
                      </button>
                      <button
                        onClick={() => {
                          setMode('scan');
                          // Will use different handler for address-only scan
                        }}
                        className="p-3 bg-white border-2 border-gray-200 hover:border-green-300 rounded-xl text-center transition-all"
                      >
                        <Camera className="w-5 h-5 text-green-600 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-gray-900">Scan QR</div>
                      </button>
                      <button
                        onClick={() => alert('Contacts feature coming soon!')}
                        className="p-3 bg-white border-2 border-gray-200 hover:border-purple-300 rounded-xl text-center transition-all"
                      >
                        <User className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-gray-900">Contacts</div>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleAddressNext}
                    disabled={!recipientAddress || recipientAddress.length < 26}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review payment →
                  </button>
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
                            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors"
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
                  <div className="glass p-5 rounded-xl space-y-4">
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
                      className="flex-1 py-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        // Switch chain and proceed to confirm
                        console.log(`🔄 [QuickPay] Switching chain: ${currentChain} → ${parsedQR.chain}`);
                        switchChain(parsedQR.chain);
                        setScannedAddress(parsedQR.address);
                        setScannedAmount(parsedQR.amount || '');
                        setNeedsChainSwitch(false);
                        setMode('confirm');
                      }}
                      className="flex-1 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Switch & Continue
                    </button>
                  </div>
                </motion.div>
              )}

            {/* LIGHTNING QR DISPLAY */}
            {mode === 'lightning' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-2">Receive</div>
                    <div className="text-4xl font-bold text-gray-900 mb-2">€{amount.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Lightning Network Payment</div>
                  </div>

                  {lightningQR && (
                    <div className="bg-white border-2 border-purple-200 rounded-xl p-6">
                      <div className="mb-4 text-sm text-gray-600 text-center">
                        Scan with Lightning wallet to pay
                      </div>
                      <img 
                        src={lightningQR} 
                        alt="Lightning QR" 
                        className="mx-auto rounded-xl"
                      />
                      <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="text-xs text-gray-600 mb-1 text-center">Invoice</div>
                        <div className="text-xs font-mono break-all text-gray-900 text-center">
                          lnbc{amount * 10000}u1p3xn...
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`lnbc${amount * 10000}u1p3xnhqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqsfpp3x9et2e20v6pu37c5d9vax37wxq72un98k6vcx9fz94w0qf237cm`);
                          }}
                          className="w-full mt-3 py-2 rounded-lg bg-white border border-purple-300 hover:bg-purple-50 text-purple-700 font-semibold text-sm transition-colors"
                        >
                          <Copy className="w-4 h-4 inline mr-2" />
                          Copy invoice
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-purple-600" />
                      <div className="text-sm font-semibold text-gray-900">Free • Instant</div>
                    </div>
                      <div className="text-xs text-gray-600">⏱️ Expires in 14:52</div>
                    </div>
                  </motion.div>
              )}

            {/* CONFIRMATION SCREEN */}
            {mode === 'confirm' && scannedAddress && (
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

                  <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-6">
                    <div className="text-sm text-gray-600 mb-2">You're sending</div>
                    <div className="text-4xl font-bold text-gray-900 mb-1">
                      €{scannedAmount || amount.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600 flex items-center justify-center gap-2">
                      <span>{QRParser.getChainInfo(currentChain as ChainType)?.icon || '?'}</span>
                      Via {QRParser.getChainInfo(currentChain as ChainType)?.name || currentChain} network
                    </div>
                  </div>

                  <div className="bg-white border-2 border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">To address</span>
                      <div className="text-right">
                        <div className="font-mono text-sm font-medium text-gray-900 break-all">
                          {scannedAddress.slice(0, 6)}...{scannedAddress.slice(-4)}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(scannedAddress);
                          }}
                          className="text-xs text-orange-600 hover:text-orange-700 mt-1"
                        >
                          Copy full address
                        </button>
                      </div>
                    </div>
                    
                    <div className="h-px bg-gray-200" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Network fee</span>
                      <span className="text-sm font-medium text-gray-900">
                        {currentChain === 'solana' ? '~€0.0001' : '~€0.50'}
                      </span>
                    </div>
                    
                    <div className="h-px bg-gray-200" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-base font-semibold text-gray-900">Total</span>
                      <span className="text-base font-bold text-gray-900">
                        €{(parseFloat(scannedAmount || amount.toString()) + (currentChain === 'solana' ? 0.0001 : 0.50)).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-gray-700">
                        <strong>Double-check the address!</strong> Crypto transactions cannot be reversed.
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setScannedAddress('');
                        setScannedAmount('');
                        setParsedQR(null);
                        setMode('method');
                      }}
                      className="flex-1 py-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmPayment}
                      className="flex-1 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold transition-all shadow-lg"
                    >
                      Confirm & send
                    </button>
                  </div>
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
                    €{scannedAmount || amount.toFixed(2)}
                  </div>
                </div>
              )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
