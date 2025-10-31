/**
 * ⚡ LIGHTNING MODAL
 * 
 * Handle Lightning Network payments:
 * - Generate Lightning invoices (receive)
 * - Pay Lightning invoices (send)
 * - Show Lightning balance
 * - Display QR codes for invoices
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Zap, Copy, CheckCircle2, QrCode, ArrowRight, 
  Loader2, AlertTriangle, TrendingDown, Clock
} from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { LightningService, LightningUtils } from '@/lib/lightning-service';
import QRCode from 'qrcode';
import ParticleEffect from './ParticleEffect';

interface LightningModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'send' | 'receive'; // Default mode
}

export default function LightningModal({ isOpen, onClose, mode = 'receive' }: LightningModalProps) {
  const { currentChain, mnemonic } = useWalletStore();
  const [activeMode, setActiveMode] = useState<'send' | 'receive'>(mode);
  const [step, setStep] = useState<'input' | 'generating' | 'confirm' | 'processing' | 'success'>('input');
  
  // Receive mode states
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveDescription, setReceiveDescription] = useState('');
  const [generatedInvoice, setGeneratedInvoice] = useState('');
  const [invoiceQR, setInvoiceQR] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Send mode states
  const [sendInvoice, setSendInvoice] = useState('');
  const [parsedAmount, setParsedAmount] = useState(0);
  const [estimatedFee, setEstimatedFee] = useState(0);
  
  // Common states
  const [error, setError] = useState('');
  const [showSuccessParticles, setShowSuccessParticles] = useState(false);
  const [paymentHash, setPaymentHash] = useState('');

  const lightningService = new LightningService({ network: 'mainnet' });

  useBlockBodyScroll(isOpen);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveMode(mode);
      setStep('input');
      setError('');
      setReceiveAmount('');
      setReceiveDescription('');
      setSendInvoice('');
      setGeneratedInvoice('');
      setInvoiceQR('');
      setCopied(false);
    }
  }, [isOpen, mode]);

  // Parse invoice when entered in send mode
  useEffect(() => {
    if (activeMode === 'send' && sendInvoice) {
      try {
        if (LightningService.isValidInvoice(sendInvoice)) {
          const parsed = lightningService.parseInvoice(sendInvoice);
          setParsedAmount(parsed.amount || 0);
          setEstimatedFee(LightningUtils.estimateFee(parsed.amount || 0));
          setError('');
        } else {
          setError('Invalid Lightning invoice format');
          setParsedAmount(0);
          setEstimatedFee(0);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to parse invoice');
        setParsedAmount(0);
        setEstimatedFee(0);
      }
    }
  }, [sendInvoice, activeMode]);

  const handleGenerateInvoice = async () => {
    try {
      setStep('generating');
      setError('');

      const amount = parseFloat(receiveAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      // Generate invoice
      const invoice = await lightningService.generateInvoice(
        Math.floor(amount),
        receiveDescription || 'Payment request',
        3600 // 1 hour expiry
      );

      setGeneratedInvoice(invoice.paymentRequest);
      setPaymentHash(invoice.paymentHash);

      // Generate QR code
      const qr = await QRCode.toDataURL(invoice.paymentRequest, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300,
      });
      setInvoiceQR(qr);

      setStep('success');
      setShowSuccessParticles(true);
      setTimeout(() => setShowSuccessParticles(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to generate invoice');
      setStep('input');
    }
  };

  const handlePayInvoice = async () => {
    try {
      setStep('processing');
      setError('');

      if (!sendInvoice) {
        throw new Error('Please enter a Lightning invoice');
      }

      // Pay invoice
      const payment = await lightningService.payInvoice(sendInvoice, 100); // Max 100 sats fee

      setPaymentHash(payment.paymentHash);
      setStep('success');
      setShowSuccessParticles(true);
      setTimeout(() => setShowSuccessParticles(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Payment failed');
      setStep('input');
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClose = () => {
    setStep('input');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {showSuccessParticles && <ParticleEffect trigger={showSuccessParticles} />}
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md glass-card overflow-hidden"
          style={{ maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-theme-bg-primary border-b border-theme-border z-10 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Lightning Network</h2>
                  <p className="text-sm text-gray-600">Instant, low-fee Bitcoin payments</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg hover:bg-theme-bg-secondary transition-colors flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Mode Selector */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setActiveMode('receive')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  activeMode === 'receive'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'bg-theme-bg-secondary text-gray-600 hover:bg-gray-200'
                }`}
              >
                Receive
              </button>
              <button
                onClick={() => setActiveMode('send')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  activeMode === 'send'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'bg-theme-bg-secondary text-gray-600 hover:bg-gray-200'
                }`}
              >
                Send
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
              >
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">{error}</p>
                </div>
              </motion.div>
            )}

            {/* ===== RECEIVE MODE ===== */}
            {activeMode === 'receive' && (
              <>
                {step === 'input' && (
                  <div className="space-y-4">
                    {/* Amount Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount (satoshis)
                      </label>
                      <input
                        type="number"
                        value={receiveAmount}
                        onChange={(e) => setReceiveAmount(e.target.value)}
                        placeholder="Enter amount in sats"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Typical Lightning payment: 1,000 - 1,000,000 sats
                      </p>
                    </div>

                    {/* Description Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        value={receiveDescription}
                        onChange={(e) => setReceiveDescription(e.target.value)}
                        placeholder="What is this payment for?"
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      />
                    </div>

                    {/* Info Card */}
                    <div className="glass-card p-4 bg-purple-50 border-purple-200">
                      <div className="flex items-start gap-3">
                        <Zap className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-purple-900 mb-1">
                            Lightning Network Benefits
                          </p>
                          <ul className="text-xs text-purple-700 space-y-1">
                            <li>• Instant settlement (seconds)</li>
                            <li>• Ultra-low fees (~0.1%)</li>
                            <li>• Perfect for small payments</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Generate Button */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleGenerateInvoice}
                      disabled={!receiveAmount || parseFloat(receiveAmount) <= 0}
                      className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Generate Invoice
                    </motion.button>
                  </div>
                )}

                {step === 'generating' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                    <p className="text-gray-600">Generating Lightning invoice...</p>
                  </div>
                )}

                {step === 'success' && generatedInvoice && (
                  <div className="space-y-4">
                    {/* Success Message */}
                    <div className="flex items-center justify-center gap-3 py-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                      <p className="text-lg font-semibold text-gray-900">Invoice Generated!</p>
                    </div>

                    {/* QR Code */}
                    {invoiceQR && (
                      <div className="flex justify-center">
                        <div className="p-4 bg-white rounded-xl border-2 border-gray-200">
                          <img src={invoiceQR} alt="Invoice QR Code" className="w-64 h-64" />
                        </div>
                      </div>
                    )}

                    {/* Invoice Details */}
                    <div className="glass-card p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Amount:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {LightningUtils.formatPayment(parseFloat(receiveAmount))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Expires:</span>
                        <span className="text-sm text-gray-900">In 1 hour</span>
                      </div>
                    </div>

                    {/* Invoice String */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lightning Invoice
                      </label>
                      <div className="relative">
                        <textarea
                          value={generatedInvoice}
                          readOnly
                          rows={3}
                          className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono resize-none"
                        />
                        <button
                          onClick={() => handleCopy(generatedInvoice)}
                          className="absolute top-3 right-3 p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          {copied ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <Copy className="w-5 h-5 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Done Button */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleClose}
                      className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      Done
                    </motion.button>
                  </div>
                )}
              </>
            )}

            {/* ===== SEND MODE ===== */}
            {activeMode === 'send' && (
              <>
                {step === 'input' && (
                  <div className="space-y-4">
                    {/* Invoice Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lightning Invoice (BOLT11)
                      </label>
                      <textarea
                        value={sendInvoice}
                        onChange={(e) => setSendInvoice(e.target.value)}
                        placeholder="lnbc... (paste Lightning invoice here)"
                        rows={4}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm font-mono resize-none"
                      />
                    </div>

                    {/* Parsed Invoice Info */}
                    {parsedAmount > 0 && (
                      <div className="glass-card p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Amount:</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {LightningUtils.formatPayment(parsedAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Est. Fee:</span>
                          <span className="text-sm text-green-600">
                            ~{estimatedFee} sats
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total:</span>
                          <span className="text-sm font-bold text-gray-900">
                            {LightningUtils.formatPayment(parsedAmount + estimatedFee)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Info Card */}
                    <div className="glass-card p-4 bg-blue-50 border-blue-200">
                      <div className="flex items-start gap-3">
                        <TrendingDown className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-blue-900 mb-1">
                            Lightning fees are tiny
                          </p>
                          <p className="text-xs text-blue-700">
                            Typical fee: 0.1% + 1 sat base fee. Much cheaper than on-chain!
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Pay Button */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handlePayInvoice}
                      disabled={!sendInvoice || !LightningService.isValidInvoice(sendInvoice)}
                      className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Pay Invoice
                    </motion.button>
                  </div>
                )}

                {step === 'processing' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                    <p className="text-gray-600">Processing Lightning payment...</p>
                    <p className="text-xs text-gray-500 mt-2">This usually takes just seconds</p>
                  </div>
                )}

                {step === 'success' && (
                  <div className="space-y-4">
                    {/* Success Message */}
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mb-4">
                        <Zap className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Sent!</h3>
                      <p className="text-gray-600 text-center">
                        Your Lightning payment was successful
                      </p>
                    </div>

                    {/* Payment Details */}
                    <div className="glass-card p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Amount:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {LightningUtils.formatPayment(parsedAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Fee:</span>
                        <span className="text-sm text-green-600">
                          {estimatedFee} sats
                        </span>
                      </div>
                      <div className="h-px bg-gray-200 my-2" />
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700">Payment Hash:</span>
                      </div>
                      <p className="text-xs font-mono text-gray-600 break-all bg-gray-50 p-2 rounded">
                        {paymentHash.substring(0, 64)}...
                      </p>
                    </div>

                    {/* Done Button */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleClose}
                      className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      Done
                    </motion.button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

