import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// 🔍 EXTENSIVE DEBUGGING FOR ENV VAR ISSUES
console.group('🚀 SUPABASE INITIALIZATION DEBUG');
console.log('📍 Location:', typeof window !== 'undefined' ? 'BROWSER' : 'SERVER');
console.log('⏰ Time:', new Date().toISOString());

// Get environment variables with multiple fallback methods
// Method 1: process.env (works in Node.js / Server-side / Build time)
// Method 2: Direct from next.config.mjs env export (for client-side)
const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('📦 Environment variable sources:', {
  hasProcessEnv: typeof process !== 'undefined' && typeof process.env !== 'undefined',
  processEnvKeys: typeof process !== 'undefined' && typeof process.env !== 'undefined' 
    ? Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC')).length + ' keys'
    : 'N/A',
});

console.log('📦 Raw values:', {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : undefined,
  allEnvKeys: typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC'))
    : [],
});

// Detailed value inspection
if (supabaseUrl) {
  console.log('✅ NEXT_PUBLIC_SUPABASE_URL:', {
    exists: true,
    length: supabaseUrl.length,
    first10: supabaseUrl.substring(0, 10),
    last10: supabaseUrl.substring(supabaseUrl.length - 10),
    hasNewline: supabaseUrl.includes('\n'),
    hasCarriageReturn: supabaseUrl.includes('\r'),
    trimmedLength: supabaseUrl.trim().length,
  });
} else {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is:', supabaseUrl);
  console.error('❌ Type:', typeof supabaseUrl);
}

if (supabaseAnonKey) {
  console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY:', {
    exists: true,
    length: supabaseAnonKey.length,
    first20: supabaseAnonKey.substring(0, 20),
    last20: supabaseAnonKey.substring(supabaseAnonKey.length - 20),
    hasNewline: supabaseAnonKey.includes('\n'),
    hasCarriageReturn: supabaseAnonKey.includes('\r'),
    trimmedLength: supabaseAnonKey.trim().length,
    startsWithEyJ: supabaseAnonKey.startsWith('eyJ'),
  });
} else {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is:', supabaseAnonKey);
  console.error('❌ Type:', typeof supabaseAnonKey);
}

// CRITICAL: Validate environment variables before creating client
if (!supabaseUrl) {
  console.error('💥 FATAL: NEXT_PUBLIC_SUPABASE_URL is missing!');
  console.error('💥 All env vars:', process.env);
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required but not set');
}

if (!supabaseAnonKey) {
  console.error('💥 FATAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing!');
  console.error('💥 All env vars:', process.env);
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required but not set');
}

// Trim any whitespace that might have snuck in
const cleanUrl = supabaseUrl.trim();
const cleanKey = supabaseAnonKey.trim();

console.log('🧹 After trimming:', {
  urlChanged: cleanUrl !== supabaseUrl,
  keyChanged: cleanKey !== supabaseAnonKey,
  cleanUrlLength: cleanUrl.length,
  cleanKeyLength: cleanKey.length,
});

console.log('🎯 About to create Supabase client with:');
console.log('   URL:', cleanUrl);
console.log('   Key:', `${cleanKey.substring(0, 20)}...${cleanKey.substring(cleanKey.length - 20)}`);

let supabaseClient;

try {
  // Create Supabase client with validated, cleaned values
  supabaseClient = createClient(
    cleanUrl,
    cleanKey,
    {
      auth: {
        persistSession: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
  
  console.log('✅ Supabase client created successfully!');
  console.groupEnd();
} catch (error) {
  console.error('💥 FATAL ERROR creating Supabase client:', error);
  console.error('💥 Error details:', {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  console.groupEnd();
  throw error;
}

export const supabase = supabaseClient;

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

