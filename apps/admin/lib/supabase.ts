import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

logger.log('🔍 Supabase Configuration Check:');
logger.log('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.slice(0, 20)}...` : '❌ NOT SET');
logger.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? `${supabaseAnonKey.slice(0, 20)}...` : '❌ NOT SET');

// Warn during build if variables are missing, but don't crash
if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window === 'undefined') {
    // Server-side (build time or runtime)
    logger.warn('⚠️  Supabase environment variables not set. Some features may not work.');
    logger.warn('⚠️  Required variables:');
    logger.warn('    - NEXT_PUBLIC_SUPABASE_URL');
    logger.warn('    - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
}

// Create Supabase client with fallback values (will be overridden at runtime)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: false,
    },
  }
);

// Database Types
export interface PriorityListRegistration {
  id: string;
  wallet_address: string;
  email?: string;
  telegram?: string;
  twitter?: string;
  referral_code?: string;
  referred_by?: string;
  is_verified: boolean;
  is_early_bird: boolean;
  position?: number;
  registered_at: string;
  email_verified_at?: string;
  email_verification_token?: string;
  created_at: string;
  updated_at: string;
}

export interface PriorityListStats {
  total_registered: number;
  verified_count: number;
  referral_count: number;
  early_bird_count: number;
  email_provided_count: number;
  last_registration: string | null;
}

export interface ReferralLeaderboardEntry {
  wallet_address: string;
  email?: string;
  referral_code?: string;
  referral_count: number;
  registered_at: string;
}

