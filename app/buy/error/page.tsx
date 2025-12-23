'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { XCircle, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

function BuyErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  useEffect(() => {
    // Get query parameters
    const error = searchParams.get('error') || searchParams.get('type');
    const txId = searchParams.get('transactionId');
    
    setErrorType(error || 'cancelled');
    setTransactionId(txId);

    // Show error message
    toast.error('Payment was cancelled or failed. Please try again.', {
      duration: 5000,
      icon: '❌',
    });

    // Set loading to false after a short delay
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, [searchParams]);

  const getErrorMessage = () => {
    switch (errorType?.toLowerCase()) {
      case 'cancelled':
      case 'canceled':
        return {
          title: 'Payment Cancelled',
          message: 'You cancelled the payment. No charges were made.',
        };
      case 'expired':
        return {
          title: 'Payment Expired',
          message: 'The payment session has expired. Please start a new transaction.',
        };
      case 'failed':
        return {
          title: 'Payment Failed',
          message: 'The payment could not be processed. Please try again or use a different payment method.',
        };
      default:
        return {
          title: 'Payment Error',
          message: 'Something went wrong with your payment. Please try again.',
        };
    }
  };

  const errorInfo = getErrorMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
      >
        {loading ? (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
            <p className="text-gray-600">Processing...</p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
            </motion.div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {errorInfo.title}
            </h1>
            
            <p className="text-gray-600 mb-6">
              {errorInfo.message}
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
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              
              <button
                onClick={() => router.back()}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function BuyErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <Loader2 className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <BuyErrorContent />
    </Suspense>
  );
}

