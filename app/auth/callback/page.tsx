'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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
              // Redirect to onboarding to show recovery phrase
              router.push('/?oauth=new_user&show_mnemonic=true');
            } else {
              // Existing user - wallet will be loaded automatically
              router.push('/');
            }
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

