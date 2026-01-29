'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateEnhancedFingerprint } from '@/lib/device-fingerprint-pro';
import { logger } from '@/lib/logger';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Handle OAuth callback
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragment from URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');

        if (accessToken) {
          // Set the session
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            console.error('Error getting session:', error);
            router.push('/?error=auth_failed');
            return;
          }

          if (session) {
            logger.log('✅ [OAuth] Session established for user:', session.user.id);

            // ✅ DEVICE VERIFICATION for OAuth logins
            logger.log('📱 [OAuth] Generating device fingerprint...');
            const deviceInfo = await generateEnhancedFingerprint();

            // Check if device is already trusted
            const { data: existingDevice, error: deviceError } = await supabase
              .from('trusted_devices')
              .select('*')
              .eq('user_id', session.user.id)
              .eq('device_fingerprint', deviceInfo.fingerprint)
              .maybeSingle();

            if (deviceError) {
              logger.error('❌ [OAuth] Error checking device:', deviceError);
            }

            // TRUSTED DEVICE - Allow immediate access
            if (existingDevice && existingDevice.verified_at) {
              logger.log('✅ [OAuth] TRUSTED device detected');

              // Update last_used_at
              await supabase
                .from('trusted_devices')
                .update({
                  last_used_at: new Date().toISOString(),
                  is_current: true
                })
                .eq('id', existingDevice.id);

              // Track login
              try {
                const { trackAuth } = await import('@/lib/analytics');
                await trackAuth(session.user.id, 'login', {
                  success: true,
                  method: 'oauth',
                  provider: 'google_or_apple'
                });
              } catch (err) {
                console.error('Failed to track login:', err);
              }

              // Check if user has a wallet in Supabase
              const { data: wallet } = await supabase
                .from('wallets')
                .select('id')
                .eq('user_id', session.user.id)
                .single();

              if (!wallet) {
                // New user from OAuth - needs to create wallet
                router.push('/?oauth=new_user&show_mnemonic=true');
              } else {
                // Existing user - wallet will be loaded automatically
                router.push('/');
              }
              return;
            }

            // NEW/UNVERIFIED DEVICE - Require verification
            logger.log('⚠️ [OAuth] NEW device detected - requiring verification');

            // Store device verification token in localStorage
            const verificationToken = crypto.randomUUID();
            localStorage.setItem('device_verification_pending', 'true');
            localStorage.setItem('device_verification_token', verificationToken);
            localStorage.setItem('device_verification_user_id', session.user.id);

            // Send verification email via API
            try {
              await fetch('/api/verify-device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: session.user.id,
                  email: session.user.email,
                  deviceInfo: {
                    fingerprint: deviceInfo.fingerprint,
                    deviceName: deviceInfo.deviceName,
                    browser: deviceInfo.browser,
                    os: deviceInfo.os,
                    location: deviceInfo.location,
                    ipAddress: deviceInfo.ipAddress || 'Unknown',
                    userAgent: navigator.userAgent,
                  }
                })
              });

              logger.log('✅ [OAuth] Verification email sent');
            } catch (emailError) {
              logger.error('❌ [OAuth] Failed to send verification email:', emailError);
            }

            // Redirect to device verification page
            router.push('/?device_verification_required=true');
          } else {
            router.push('/?error=no_session');
          }
        } else {
          // No access token, redirect to home
          router.push('/');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        router.push('/?error=callback_failed');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-orange-500 mb-4"></div>
        <h2 className="text-white text-2xl font-bold mb-2">Signing you in...</h2>
        <p className="text-gray-400">Please wait while we complete your authentication</p>
      </div>
    </div>
  );
}

