import { supabase } from '@/lib/supabase';
import { secureStorage } from '@/lib/secure-storage';
import { logger } from '@/lib/logger';

export interface EmailIdentity {
  email: string;
  userId: string;
  createdWithEmail: true;
}

function getLocalIdentity(): EmailIdentity | null {
  if (typeof window === 'undefined') return null;
  const email = localStorage.getItem('wallet_email');
  const userId = localStorage.getItem('supabase_user_id');
  const createdWithEmail = localStorage.getItem('wallet_created_with_email') === 'true';

  if (email && userId && createdWithEmail) {
    return { email, userId, createdWithEmail: true };
  }

  return null;
}

async function getSecureIdentity(): Promise<EmailIdentity | null> {
  const email = await secureStorage.getItem('wallet_email');
  const userId = await secureStorage.getItem('supabase_user_id');
  const createdWithEmail = await secureStorage.getItem('wallet_created_with_email');

  if (email && userId && createdWithEmail === 'true') {
    return { email, userId, createdWithEmail: true };
  }

  return null;
}

function syncIdentityToLocal(identity: EmailIdentity): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('wallet_email', identity.email);
  localStorage.setItem('supabase_user_id', identity.userId);
  localStorage.setItem('wallet_created_with_email', 'true');
}

async function syncIdentityToSecure(identity: EmailIdentity): Promise<void> {
  await secureStorage.setItem('wallet_email', identity.email);
  await secureStorage.setItem('supabase_user_id', identity.userId);
  await secureStorage.setItem('wallet_created_with_email', 'true');
}

export async function persistEmailIdentity(params: {
  email: string;
  userId: string;
  encryptedWallet?: string;
  markSessionUnlocked?: boolean;
}): Promise<EmailIdentity> {
  const identity: EmailIdentity = {
    email: params.email,
    userId: params.userId,
    createdWithEmail: true,
  };

  if (params.encryptedWallet) {
    await secureStorage.setItem('encrypted_wallet', params.encryptedWallet);
    await secureStorage.setItem('has_password', 'true');
  }

  await syncIdentityToSecure(identity);
  syncIdentityToLocal(identity);

  if (typeof window !== 'undefined' && params.markSessionUnlocked) {
    sessionStorage.setItem('wallet_unlocked_this_session', 'true');
  }

  return identity;
}

export async function resolveCurrentIdentity(): Promise<EmailIdentity | null> {
  const secureIdentity = await getSecureIdentity();
  if (secureIdentity) {
    syncIdentityToLocal(secureIdentity);
    return secureIdentity;
  }

  const localIdentity = getLocalIdentity();
  if (localIdentity) {
    await syncIdentityToSecure(localIdentity);
    return localIdentity;
  }

  return null;
}

export async function selfHealIdentityFromSession(): Promise<EmailIdentity | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    const userId = session?.user?.id;

    if (!email || !userId) {
      return null;
    }

    const identity = await persistEmailIdentity({ email, userId });
    logger.log('🩹 [Identity] Repaired email identity from active session');
    return identity;
  } catch (error) {
    logger.warn('⚠️ [Identity] Could not heal identity from session:', error);
    return null;
  }
}

