// Supabase Auth Service for BLAZE Wallet
// Handles email/social authentication and encrypted wallet storage

import { supabase } from './supabase';
import * as bip39 from 'bip39';
import { ethers } from 'ethers';
import { logger } from '@/lib/logger';
import { logFeatureUsage } from '@/lib/analytics-tracker';

// =============================================================================
// ENCRYPTION UTILITIES
// =============================================================================

/**
 * Encrypt wallet mnemonic with user's password
 * Uses AES-256-GCM for encryption
 */
async function encryptMnemonic(mnemonic: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Derive key from password using PBKDF2
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Salt for key derivation
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive AES key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // IV for encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(mnemonic)
  );

  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt wallet mnemonic with user's password
 */
async function decryptMnemonic(encryptedData: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  // Extract salt, iv, and encrypted data
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);

  // Derive key from password
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encrypted
  );

  return decoder.decode(decrypted);
}

// =============================================================================
// AUTH FUNCTIONS
// =============================================================================

export interface SignUpResult {
  success: boolean;
  error?: string;
  user?: any;
  mnemonic?: string;
}

export interface SignInResult {
  success: boolean;
  error?: string;
  user?: any;
  mnemonic?: string;
}

/**
 * Sign up with email and password
 * Creates new wallet and uploads encrypted version to Supabase
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<SignUpResult> {
  try {
    // 1. Create Supabase user (with email confirmation disabled - we handle it via Resend)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'https://my.blazewallet.io'}/auth/verify`,
        data: {
          email_confirm: false, // Disable Supabase's built-in email confirmation
        }
      }
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' };
    }

    // 2. Generate new wallet mnemonic
    const mnemonic = bip39.generateMnemonic();

    // 3. Encrypt mnemonic with user's password
    const encryptedWallet = await encryptMnemonic(mnemonic, password);

    // 4. Get wallet address for metadata/analytics (NOT used for unlock - only for display)
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
    const walletAddress = hdNode.address;

    // 5. Upload encrypted wallet to Supabase (via secure server endpoint)
    // ⚠️ NOTE: wallet_address is stored for convenience/analytics only
    // ⚠️ On unlock, addresses are ALWAYS derived fresh from encrypted mnemonic
    try {
      // Get CSRF token first
      const csrfResponse = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfResponse.json();
      
      const walletResponse = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          userId: authData.user.id,
          encryptedMnemonic: encryptedWallet,
        }),
      });
      
      const walletData = await walletResponse.json();
      
      if (!walletData.success) {
        logger.error('Failed to save encrypted wallet:', walletData.error);
        // User is created but wallet save failed - still return success
        // User can always recover with mnemonic
      }
    } catch (walletError: any) {
      logger.error('Failed to save encrypted wallet:', walletError);
      // User is created but wallet save failed - still return success
    }

    // 6. Store wallet flags locally (NOT addresses - they're derived on unlock)
    if (typeof window !== 'undefined') {
      localStorage.setItem('wallet_email', email);
      localStorage.setItem('has_password', 'true'); // Password is already set via email
      localStorage.setItem('encrypted_wallet', encryptedWallet); // Store encrypted version
      localStorage.setItem('wallet_created_with_email', 'true'); // Flag to skip password setup modal
      localStorage.setItem('supabase_user_id', authData.user!.id); // ✅ Store Supabase user ID for biometric binding
      localStorage.setItem('email_verified', 'false'); // ✅ NEW: Track verification status
      // Session flag to skip unlock modal in same session
      sessionStorage.setItem('wallet_unlocked_this_session', 'true');
      // ✅ SECURITY: Addresses are NEVER stored - they're derived from mnemonic on unlock
      // ✅ SECURITY: DO NOT store plaintext mnemonic in localStorage for email signups
      // It will be returned to user for backup, but not persisted locally
    }

    // 7. Send custom welcome + verification email via API route
    try {
      const response = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          userId: authData.user.id, // Send user ID to generate secure token server-side
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        logger.log('✅ Welcome email sent to:', email);
      } else {
        logger.error('Failed to send welcome email:', result.error);
      }
    } catch (emailError) {
      // Don't fail signup if email fails
      logger.error('Failed to send welcome email:', emailError);
    }

    // Track successful signup
    await logFeatureUsage('user_signup', { 
      method: 'email',
      hasWallet: true 
    });

    return {
      success: true,
      user: authData.user,
      mnemonic, // Return mnemonic so user can back it up
    };
  } catch (error: any) {
    logger.error('Sign up error:', error);
    return { success: false, error: error.message || 'Failed to sign up' };
  }
}

/**
 * Sign in with email and password
 * Downloads and decrypts wallet from Supabase
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<SignInResult> {
  try {
    // 1. Sign in to Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to sign in' };
    }

    // 2. Download encrypted wallet (via secure server endpoint)
    // Get CSRF token first
    const csrfResponse = await fetch('/api/csrf-token');
    const { token: csrfToken } = await csrfResponse.json();
    
    const walletResponse = await fetch('/api/get-wallet', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ userId: authData.user.id }),
    });
    
    const walletData = await walletResponse.json();
    
    if (!walletData.success || !walletData.encrypted_mnemonic) {
      return { success: false, error: 'Wallet not found. Please use recovery phrase.' };
    }

    // 3. Decrypt wallet
    const mnemonic = await decryptMnemonic(walletData.encrypted_mnemonic, password);

    // 4. Store wallet flags locally (NOT addresses - they're derived on unlock)
    if (typeof window !== 'undefined') {
      localStorage.setItem('wallet_email', email);
      localStorage.setItem('has_password', 'true'); // Password is verified
      localStorage.setItem('encrypted_wallet', walletData.encrypted_mnemonic);
      localStorage.setItem('wallet_created_with_email', 'true'); // Flag to skip password setup modal
      localStorage.setItem('supabase_user_id', authData.user!.id); // ✅ NEW: Store Supabase user ID for biometric binding
      // Session flag to skip unlock modal in same session
      sessionStorage.setItem('wallet_unlocked_this_session', 'true');
      // ✅ SECURITY: Addresses are NEVER stored - they're derived from mnemonic on unlock
      // ✅ SECURITY: NEVER store plaintext mnemonic in localStorage
      // Mnemonic is returned directly and handled in memory only
    }

    // Track successful login
    await logFeatureUsage('user_login', { 
      method: 'email',
      hasWallet: true 
    });

    return {
      success: true,
      user: authData.user,
      mnemonic,
    };
  } catch (error: any) {
    logger.error('Sign in error:', error);
    return { success: false, error: error.message || 'Failed to sign in' };
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Google sign in error:', error);
    return { success: false, error: error.message || 'Failed to sign in with Google' };
  }
}

/**
 * Sign in with Apple
 */
export async function signInWithApple(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Apple sign in error:', error);
    return { success: false, error: error.message || 'Failed to sign in with Apple' };
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, error: error.message };
    }

    // Clear local wallet data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('encrypted_wallet');
      localStorage.removeItem('wallet_email');
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Sign out error:', error);
    return { success: false, error: error.message || 'Failed to sign out' };
  }
}

/**
 * Get current session
 */
export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Check if user has wallet in Supabase (via secure server endpoint)
 */
export async function hasCloudWallet(userId: string): Promise<boolean> {
  try {
    // Get CSRF token first
    const csrfResponse = await fetch('/api/csrf-token');
    const { token: csrfToken } = await csrfResponse.json();
    
    const response = await fetch('/api/wallet/exists', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ userId }),
    });
    
    const data = await response.json();
    return data.success && data.exists;
  } catch (error) {
    logger.error('Failed to check cloud wallet:', error);
    return false;
  }
}

/**
 * Update encrypted wallet in cloud (via secure server endpoint)
 * (e.g., if user changes password or wants to backup existing wallet)
 */
export async function updateCloudWallet(
  userId: string,
  mnemonic: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const encryptedWallet = await encryptMnemonic(mnemonic, password);

    // Get CSRF token first
    const csrfResponse = await fetch('/api/csrf-token');
    const { token: csrfToken } = await csrfResponse.json();

    const response = await fetch('/api/wallet/update', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        userId,
        encryptedMnemonic: encryptedWallet,
      }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Update cloud wallet error:', error);
    return { success: false, error: error.message || 'Failed to update cloud wallet' };
  }
}

/**
 * Upgrade a seed phrase wallet to an email account
 * Links existing wallet (with same seed phrase) to email for cloud backup
 */
export async function upgradeToEmailAccount(
  email: string,
  password: string,
  existingMnemonic: string
): Promise<SignUpResult> {
  try {
    logger.log('🔄 Starting wallet upgrade to email account...');

    // 1. Validate that the mnemonic is valid BIP39
    const cleanMnemonic = existingMnemonic.trim().toLowerCase();
    if (!bip39.validateMnemonic(cleanMnemonic)) {
      return { success: false, error: 'Invalid seed phrase' };
    }

    // 2. Create Supabase user (with email confirmation disabled - we handle it via Resend)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'https://my.blazewallet.io'}/auth/verify`,
        data: {
          email_confirm: false, // Disable Supabase's built-in email confirmation
        }
      }
    });

    if (authError) {
      // Check if email already exists
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        return { success: false, error: 'This email is already in use. Please sign in instead.' };
      }
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' };
    }

    logger.log('✅ Supabase user created:', authData.user.id);

    // 3. Encrypt existing mnemonic with NEW password
    const encryptedWallet = await encryptMnemonic(cleanMnemonic, password);

    // 4. Get wallet address for metadata/analytics (NOT used for unlock - only for display)
    const hdNode = ethers.HDNodeWallet.fromPhrase(cleanMnemonic);
    const walletAddress = hdNode.address;

    logger.log('📦 Wallet address (for display only):', walletAddress);

    // 5. Upload encrypted wallet to Supabase (via secure server endpoint)
    try {
      // Get CSRF token first
      const csrfResponse = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfResponse.json();
      
      const walletResponse = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          userId: authData.user.id,
          encryptedMnemonic: encryptedWallet,
        }),
      });
      
      const walletData = await walletResponse.json();
      
      if (!walletData.success) {
        logger.error('❌ Failed to save encrypted wallet:', walletData.error);
        
        // Rollback: Delete created user if wallet save fails
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
          logger.log('🔄 Rolled back: User deleted after wallet save failure');
        } catch (rollbackError) {
          logger.error('Failed to rollback user creation:', rollbackError);
        }
        
        return { success: false, error: 'Failed to save wallet. Please try again.' };
      }
    } catch (walletError: any) {
      logger.error('❌ Failed to save encrypted wallet:', walletError);
      return { success: false, error: 'Failed to save wallet. Please try again.' };
    }

    logger.log('✅ Encrypted wallet saved to cloud');

    // 6. Update localStorage to reflect email account
    if (typeof window !== 'undefined') {
      // Save old localStorage state for potential rollback
      const oldEncryptedWallet = localStorage.getItem('encrypted_wallet');
      const oldHasPassword = localStorage.getItem('has_password');
      
      try {
        // Update to email account flags
        localStorage.setItem('wallet_email', email);
        localStorage.setItem('has_password', 'true');
        localStorage.setItem('encrypted_wallet', encryptedWallet);
        localStorage.setItem('wallet_created_with_email', 'true'); // ✅ KEY: Mark as email wallet
        localStorage.setItem('supabase_user_id', authData.user.id); // ✅ Store user ID for biometric binding
        localStorage.setItem('email_verified', 'false'); // Start as unverified
        
        // Session flag to skip unlock modal in same session
        sessionStorage.setItem('wallet_unlocked_this_session', 'true');
        
        logger.log('✅ localStorage updated to email account type');
      } catch (storageError) {
        logger.error('Failed to update localStorage:', storageError);
        // Attempt rollback
        if (oldEncryptedWallet) localStorage.setItem('encrypted_wallet', oldEncryptedWallet);
        if (oldHasPassword) localStorage.setItem('has_password', oldHasPassword);
      }
    }

    // 7. Send custom welcome + verification email via API route
    try {
      const response = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          userId: authData.user.id,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        logger.log('✅ Welcome email sent to:', email);
      } else {
        logger.error('⚠️ Failed to send welcome email:', result.error);
        // Don't fail upgrade if email fails
      }
    } catch (emailError) {
      logger.error('⚠️ Failed to send welcome email:', emailError);
      // Don't fail upgrade if email fails
    }

    logger.log('🎉 Wallet upgrade complete!');

    return {
      success: true,
      user: authData.user,
      mnemonic: cleanMnemonic, // Return mnemonic (same as before, for confirmation)
    };
  } catch (error: any) {
    logger.error('❌ Upgrade error:', error);
    return { success: false, error: error.message || 'Failed to upgrade wallet' };
  }
}

