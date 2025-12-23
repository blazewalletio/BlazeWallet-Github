'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BuySuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    // Get query parameters
    const txId = searchParams.get('transactionId');
    const prov = searchParams.get('provider') || 'onramper';
    
    setTransactionId(txId);
    setProvider(prov);

    // Trigger page reload to refresh wallet balance
    // The wallet balance will be automatically refreshed when user navigates back
    // We can also trigger a custom event that the dashboard can listen to
    if (typeof window !== 'undefined') {
      // Dispatch custom event to trigger balance refresh in other components
      window.dispatchEvent(new CustomEvent('balanceRefresh'));
      
      // Also trigger a page visibility change to refresh balance
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          // Balance will be refreshed when user navigates to dashboard
        }
      }, 2000);
    }

    // Show success message
    toast.success('Payment successful! Your crypto will arrive shortly.', {
      duration: 5000,
      icon: '🎉',
    });

    // Set loading to false after a short delay
    setTimeout(() => {
      setLoading(false);
    }, 1000);

    // Auto-redirect to dashboard after 5 seconds
    const redirectTimer = setTimeout(() => {
      router.push('/dashboard');
    }, 5000);

    return () => clearTimeout(redirectTimer);
  }, [searchParams, router, refreshBalance]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
      >
        {loading ? (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
            <p className="text-gray-600">Processing your payment...</p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
            </motion.div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Payment Successful! 🎉
            </h1>
            
            <p className="text-gray-600 mb-6">
              Your payment has been processed successfully. Your crypto will arrive in your wallet shortly.
            </p>

            {transactionId && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
                <p className="text-xs font-mono text-gray-700 break-all">
                  {transactionId}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Go to Dashboard
              </button>
              
              <button
                onClick={() => router.push('/wallet')}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                View Wallet
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-6">
              Redirecting to dashboard in a few seconds...
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}

