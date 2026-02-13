'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export default function AuthSessionGuard() {
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted || !session?.access_token) return;

        const { error } = await supabase.auth.getUser();
        const status = (error as any)?.status || (error as any)?.statusCode;
        if (!error) return;

        // If session is stale/invalid, clear only local auth session to stop repeated 403 spam.
        if (status === 401 || status === 403) {
          logger.warn('[AuthSessionGuard] Clearing stale Supabase session after getUser failure:', error.message);
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch (err) {
        // Best-effort guard only.
        logger.warn('[AuthSessionGuard] Session check skipped:', err);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}


