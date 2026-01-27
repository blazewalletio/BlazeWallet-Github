'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Standalone device verification page
 * Used when clicking verification link from email
 */
function VerifyDeviceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your device...');
  
  useEffect(() => {
    const verifyDevice = async () => {
      try {
        const token = searchParams.get('token');
        const code = searchParams.get('code');
        
        if (!token || !code) {
          setStatus('error');
          setMessage('Invalid verification link');
          return;
        }
        
        logger.log('🔐 Verifying device via email link...');
        
        // Validate the token and code
        const response = await fetch('/api/verify-device-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceToken: token,
            verificationCode: code,
            step: 'validate_code',
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Verification failed');
        }
        
        setStatus('success');
        setMessage('Device verified successfully! You can now log in on this device.');
        
        // Redirect to home after 3 seconds
        setTimeout(() => {
          router.push('/');
        }, 3000);
        
      } catch (error: any) {
        logger.error('❌ Device verification failed:', error);
        setStatus('error');
        setMessage(error.message || 'Verification failed. Please try again.');
      }
    };
    
    verifyDevice();
  }, [searchParams, router]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-6 text-white text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl backdrop-blur">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">Device Verification</h1>
        </div>
        
        {/* Content */}
        <div className="p-8">
          {status === 'loading' && (
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto" />
              <p className="text-gray-700 font-medium">{message}</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-2xl">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-900 font-semibold text-lg">{message}</p>
              <p className="text-gray-600 text-sm">Redirecting...</p>
            </div>
          )}
          
          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-2xl">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-gray-900 font-semibold text-lg">Verification Failed</p>
              <p className="text-gray-600">{message}</p>
              
              <button
                onClick={() => router.push('/')}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyDevicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
      </div>
    }>
      <VerifyDeviceContent />
    </Suspense>
  );
}

