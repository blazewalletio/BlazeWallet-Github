'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Banknote, ShieldCheck, Flame, ExternalLink } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';
import { CHAINS } from '@/lib/chains';
import { TransakService } from '@/lib/transak-service';

interface BuyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BuyModal({ isOpen, onClose }: BuyModalProps) {
  const { address, currentChain } = useWalletStore();
  const chain = CHAINS[currentChain];
  const supportedAssets = TransakService.getSupportedAssets(chain.id);

  // Block body scroll when overlay is open
  useBlockBodyScroll(isOpen);

  const handleBuy = async (currencyCode?: string) => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    // Validate wallet address format for the selected currency
    if (currencyCode && !TransakService.validateWalletAddress(address, currencyCode)) {
      alert(`⚠️ Invalid wallet address format for ${currencyCode}. Please ensure you're using the correct wallet for this cryptocurrency.`);
      return;
    }

    // Create multi-chain wallet addresses for better compatibility
    const walletAddresses = TransakService.createWalletAddresses(address, chain.id);

        try {
          console.log('🔥 BUY MODAL DEBUG: Starting NEW Transak integration...');
          console.log('Wallet Address:', address);
          console.log('Wallet Addresses:', walletAddresses);
          console.log('Currency Code:', currencyCode);
          
          await TransakService.openWidget({
            walletAddress: address,
            walletAddresses: walletAddresses,
            currencyCode: currencyCode || 'ETH', // Default to ETH if undefined
            baseCurrencyCode: 'EUR', // Default to EUR for Dutch market
            apiKey: '55950bec-d22c-4d0a-937e-7bff2cb26296', // Real Transak API key (needs business profile completion)
            environment: 'STAGING', // Try STAGING first to test
            themeColor: '#F97316', // BLAZE orange
            disableWalletAddressForm: true, // Hide wallet address input since we provide it
            hideMenu: false, // Show Transak menu
            isAutoFillUserData: false, // Let users fill their own data
          });

          console.log('✅ BUY MODAL SUCCESS: Transak widget opened with session');
          // Close modal after opening Transak
          setTimeout(() => onClose(), 500);
        } catch (error) {
          console.error('❌ BUY MODAL ERROR:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Check if it's a business profile issue
          if (errorMessage.includes('Invalid API key') || errorMessage.includes('T-INF-201')) {
            alert(`Transak Error: Please complete your Business Profile in the Transak Dashboard first.\n\nGo to: dashboard.transak.com/developers\nComplete all 3 steps of "Complete Your Business Profile"`);
          } else {
            alert(`Failed to open Transak: ${errorMessage}`);
          }
        }
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
        <div className="max-w-4xl mx-auto p-6">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors"
          >
            ← Back
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Buy crypto</h2>
                <p className="text-sm text-gray-600">
                  With iDEAL, credit card or bank transfer
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">

            {/* Features */}
            <div className="glass-card p-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-orange-500/10 rounded-xl">
                  <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">Instant</p>
                </div>
                <div className="text-center p-4 bg-emerald-500/10 rounded-xl">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">Secure</p>
                </div>
                <div className="text-center p-4 bg-purple-500/10 rounded-xl">
                  <CreditCard className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">Easy</p>
                </div>
              </div>
            </div>

            {/* Popular Assets */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular crypto</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {supportedAssets.slice(0, 6).map((currencyCode) => {
                  const displayName = TransakService.getDisplayName(currencyCode);
                  return (
                    <motion.button
                      key={currencyCode}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleBuy(currencyCode)}
                      className="p-4 bg-gray-50 hover:bg-white rounded-xl transition-all text-left border border-gray-200 hover:border-orange-300 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center text-lg font-bold text-white">
                          {displayName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{displayName}</p>
                          <p className="text-xs text-gray-600">Buy now</p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Payment Methods */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment methods</h3>
              <div className="flex flex-wrap gap-3">
                <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 border border-gray-200">
                  <Banknote className="w-4 h-4 inline mr-2" />
                  iDEAL
                </div>
                <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 border border-gray-200">
                  <CreditCard className="w-4 h-4 inline mr-2" />
                  Credit card
                </div>
                <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 border border-gray-200">
                  Bank transfer
                </div>
                <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 border border-gray-200">
                  SEPA
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="glass-card p-6 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200">
              <div className="flex gap-4">
                <ShieldCheck className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-orange-600 font-semibold mb-2">🔥 Powered by Transak</p>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Globally trusted fiat-to-crypto service. Crypto is sent directly to your BLAZE Wallet.
                    Transaction fees: ~0.99% - 2.99%.
                  </p>
                </div>
              </div>
            </div>

            {/* Main CTA */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => handleBuy()}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
            >
              <Flame className="w-5 h-5" />
              Start buying
              <ExternalLink className="w-4 h-4" />
            </motion.button>

            {/* Disclaimer */}
            <p className="text-xs text-gray-500 text-center mt-4">
              By clicking you will be redirected to Transak. BLAZE Wallet does not store your payment details.
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}




