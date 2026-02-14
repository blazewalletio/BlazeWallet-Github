'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generateEnhancedFingerprint } from '@/lib/device-fingerprint-pro';
import { logger } from '@/lib/logger';
import { persistEmailIdentity } from '@/lib/account-identity';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Handle OAuth callback
    const handleAuthCallback = async () => {
      try {
        // Handle both implicit (hash token) and PKCE (code query) callback formats.
        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const code = queryParams.get('code');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            logger.error('❌ [OAuth] Failed to exchange code for session:', exchangeError);
            router.push('/?error=auth_failed');
            return;
          }
        } else if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) {
            logger.error('❌ [OAuth] Failed to set session from hash:', setSessionError);
            router.push('/?error=auth_failed');
            return;
          }
        }

        // Wait briefly for session persistence to settle.
        let session: any = null;
        let sessionError: any = null;
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const { data, error } = await supabase.auth.getSession();
          session = data.session;
          sessionError = error;
          if (session) break;
          await new Promise((resolve) => window.setTimeout(resolve, 150));
        }

        if (sessionError) {
          console.error('Error getting session:', sessionError);
          router.push('/?error=auth_failed');
          return;
        }

        if (session) {
          logger.log('✅ [OAuth] Session established for user:', session.user.id);
          if (session.user.email) {
            await persistEmailIdentity({
              email: session.user.email,
              userId: session.user.id,
            });
          }

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

          // For OAuth logins, trust current device after provider verification to keep UX smooth.
          // Email/password login keeps strict device-code verification flow.
          if (existingDevice && (existingDevice as any).verified_at) {
            logger.log('✅ [OAuth] TRUSTED device detected');
            await (supabase as any)
              .from('trusted_devices')
              .update({
                last_used_at: new Date().toISOString(),
                is_current: true
              })
              .eq('id', (existingDevice as any).id);
          } else {
            logger.log('✅ [OAuth] Trusting current OAuth device and storing as verified');
            // Ensure one current device per user.
            await (supabase as any)
              .from('trusted_devices')
              .update({ is_current: false })
              .eq('user_id', session.user.id);

            await (supabase as any)
              .from('trusted_devices')
              .upsert({
                user_id: session.user.id,
                device_name: deviceInfo.deviceName,
                device_fingerprint: deviceInfo.fingerprint,
                ip_address: deviceInfo.ipAddress || 'Unknown',
                user_agent: navigator.userAgent,
                browser: deviceInfo.browser,
                os: deviceInfo.os,
                is_current: true,
                verified_at: new Date().toISOString(),
                verification_token: null,
                verification_code: null,
                verification_code_expires_at: null,
                verification_expires_at: null,
                last_used_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id,device_fingerprint'
              });
          }

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
          const { data: wallet, error: walletLookupError } = await supabase
            .from('wallets')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (walletLookupError) {
            logger.error('❌ [OAuth] Failed to check wallet existence:', walletLookupError);
            router.push('/?error=wallet_check_failed');
            return;
          }

          if (!wallet) {
            // New user from OAuth - needs to create wallet
            router.push('/?oauth=new_user&show_mnemonic=true');
          } else {
            // Existing user - wallet will be loaded automatically
            router.push('/');
          }
        } else {
          // If callback carried auth params but session is still missing, fail explicitly.
          const hasOAuthParams = Boolean(code || accessToken || queryParams.get('error') || hashParams.get('error'));
          if (hasOAuthParams) {
            router.push('/?error=auth_failed');
            return;
          }
          // No auth params, redirect home.
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

