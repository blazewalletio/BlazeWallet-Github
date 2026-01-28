/**
 * Admin Authentication Utilities
 * Shared functions for verifying admin sessions across API routes
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface AdminUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Verify admin session from Authorization header or cookie
 * Returns admin user if valid, null otherwise
 */
export async function verifyAdminSession(request: NextRequest): Promise<AdminUser | null> {
  try {
    // Get session token from Authorization header first, then cookie
    const authHeader = request.headers.get('authorization');
    let sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      // Fallback to cookie
      sessionToken = request.cookies.get('admin_session')?.value;
    }
    
    if (!sessionToken) {
      logger.warn('[Admin Auth] No session token found in header or cookie');
      return null;
    }

    // Verify session in database
    const { data: session, error } = await supabaseAdmin
      .from('admin_sessions')
      .select('*, admin_users(*)')
      .eq('session_token', sessionToken)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !session) {
      logger.warn('[Admin Auth] Invalid or expired session');
      return null;
    }

    // Update last activity
    await supabaseAdmin
      .from('admin_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', session.id);

    const adminUser = (session as any).admin_users;

    return {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    };

  } catch (error) {
    logger.error('[Admin Auth] Session verification failed:', error);
    return null;
  }
}

/**
 * Check if user has specific role
 */
export function hasRole(user: AdminUser, role: string): boolean {
  if (user.role === 'super_admin') return true; // Super admin can do everything
  return user.role === role;
}

