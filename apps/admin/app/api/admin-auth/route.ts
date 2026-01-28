import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { nanoid } from 'nanoid';

// Admin Supabase client with service role (bypasses RLS)
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

// Session configuration
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

interface AdminUser {
  id: string;
  email: string;
  password_hash: string;
  totp_secret: string | null;
  totp_enabled: boolean;
  role: string;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
}

/**
 * POST /api/admin-auth
 * 
 * Actions:
 * - login: Email + password authentication
 * - verify-2fa: Verify TOTP code
 * - setup-2fa: Generate QR code for 2FA setup
 * - confirm-2fa: Confirm 2FA setup
 * - logout: Invalidate session
 */
export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();

    switch (action) {
      case 'login':
        return await handleLogin(request, data);
      
      case 'verify-2fa':
        return await handleVerify2FA(request, data);
      
      case 'setup-2fa':
        return await handleSetup2FA(request, data);
      
      case 'confirm-2fa':
        return await handleConfirm2FA(request, data);
      
      case 'logout':
        return await handleLogout(request, data);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Admin Auth] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * STEP 1: Email + Password Login
 */
async function handleLogin(request: NextRequest, data: any) {
  const { email, password } = data;

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password required' },
      { status: 400 }
    );
  }

  // Get client IP
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // Fetch admin user
  const { data: adminUser, error } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !adminUser) {
    // Log failed attempt
    await logAuditAction(null, 'login', 'admin_user', null, ip, userAgent, { email }, 'failure', 'User not found');
    
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }

  // Check if account is locked
  if (adminUser.locked_until && new Date(adminUser.locked_until) > new Date()) {
    const remainingTime = Math.ceil((new Date(adminUser.locked_until).getTime() - Date.now()) / 60000);
    
    await logAuditAction(adminUser.id, 'login', 'admin_user', adminUser.id, ip, userAgent, {}, 'blocked', 'Account locked');
    
    return NextResponse.json(
      { error: `Account locked. Try again in ${remainingTime} minutes.` },
      { status: 423 }
    );
  }

  // Check if account is active
  if (!adminUser.is_active) {
    await logAuditAction(adminUser.id, 'login', 'admin_user', adminUser.id, ip, userAgent, {}, 'blocked', 'Account deactivated');
    
    return NextResponse.json(
      { error: 'Account deactivated. Contact administrator.' },
      { status: 403 }
    );
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, adminUser.password_hash);

  if (!isValidPassword) {
    // Increment failed attempts
    const newFailedAttempts = (adminUser.failed_login_attempts || 0) + 1;
    const updates: any = { failed_login_attempts: newFailedAttempts };

    // Lock account if max attempts reached
    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      updates.locked_until = new Date(Date.now() + LOCKOUT_DURATION).toISOString();
    }

    await supabaseAdmin
      .from('admin_users')
      .update(updates)
      .eq('id', adminUser.id);

    await logAuditAction(adminUser.id, 'login', 'admin_user', adminUser.id, ip, userAgent, { attempt: newFailedAttempts }, 'failure', 'Invalid password');

    return NextResponse.json(
      { error: newFailedAttempts >= MAX_FAILED_ATTEMPTS 
        ? `Too many failed attempts. Account locked for 30 minutes.`
        : 'Invalid credentials'
      },
      { status: 401 }
    );
  }

  // Reset failed attempts on successful password verification
  await supabaseAdmin
    .from('admin_users')
    .update({ 
      failed_login_attempts: 0,
      locked_until: null,
    })
    .eq('id', adminUser.id);

  // Check if 2FA is enabled
  if (adminUser.totp_enabled) {
    // Create temporary token for 2FA verification
    const tempToken = nanoid(32);
    
    // Store temp token in session (expires in 5 minutes)
    await supabaseAdmin
      .from('admin_sessions')
      .insert({
        admin_user_id: adminUser.id,
        session_token: `temp_${tempToken}`,
        ip_address: ip,
        user_agent: userAgent,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        is_valid: false, // Not valid until 2FA verified
      });

    await logAuditAction(adminUser.id, 'login_step1', 'admin_user', adminUser.id, ip, userAgent, {}, 'success', 'Password verified, awaiting 2FA');

    return NextResponse.json({
      success: true,
      requires2FA: true,
      tempToken,
    });
  }

  // No 2FA - create session directly
  const sessionToken = nanoid(64);
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await supabaseAdmin
    .from('admin_sessions')
    .insert({
      admin_user_id: adminUser.id,
      session_token: sessionToken,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: expiresAt.toISOString(),
      is_valid: true,
    });

  // Update last login
  await supabaseAdmin
    .from('admin_users')
    .update({ 
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
    })
    .eq('id', adminUser.id);

  await logAuditAction(adminUser.id, 'login', 'admin_user', adminUser.id, ip, userAgent, {}, 'success');

  return NextResponse.json({
    success: true,
    sessionToken,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    },
    mustSetup2FA: !adminUser.totp_enabled,
  });
}

/**
 * STEP 2: Verify 2FA Code
 */
async function handleVerify2FA(request: NextRequest, data: any) {
  const { tempToken, code } = data;

  if (!tempToken || !code) {
    return NextResponse.json(
      { error: 'Temp token and code required' },
      { status: 400 }
    );
  }

  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // Get temp session
  const { data: tempSession, error } = await supabaseAdmin
    .from('admin_sessions')
    .select('*, admin_users(*)')
    .eq('session_token', `temp_${tempToken}`)
    .eq('is_valid', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !tempSession) {
    return NextResponse.json(
      { error: 'Invalid or expired temp token' },
      { status: 401 }
    );
  }

  const adminUser = (tempSession as any).admin_users;

  // Verify TOTP code
  const isValid = authenticator.verify({
    token: code,
    secret: adminUser.totp_secret,
  });

  if (!isValid) {
    await logAuditAction(adminUser.id, 'verify_2fa', 'admin_user', adminUser.id, ip, userAgent, {}, 'failure', 'Invalid 2FA code');
    
    return NextResponse.json(
      { error: 'Invalid 2FA code' },
      { status: 401 }
    );
  }

  // Delete temp session
  await supabaseAdmin
    .from('admin_sessions')
    .delete()
    .eq('id', tempSession.id);

  // Create real session
  const sessionToken = nanoid(64);
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await supabaseAdmin
    .from('admin_sessions')
    .insert({
      admin_user_id: adminUser.id,
      session_token: sessionToken,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: expiresAt.toISOString(),
      is_valid: true,
    });

  // Update last login
  await supabaseAdmin
    .from('admin_users')
    .update({ 
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
    })
    .eq('id', adminUser.id);

  await logAuditAction(adminUser.id, 'login', 'admin_user', adminUser.id, ip, userAgent, {}, 'success', '2FA verified');

  return NextResponse.json({
    success: true,
    sessionToken,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    },
  });
}

/**
 * STEP 3: Setup 2FA (Generate QR Code)
 */
async function handleSetup2FA(request: NextRequest, data: any) {
  const { sessionToken } = data;

  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Session token required' },
      { status: 400 }
    );
  }

  // Verify session
  const adminUser = await verifySession(sessionToken);
  if (!adminUser) {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    );
  }

  // Generate TOTP secret
  const secret = authenticator.generateSecret();

  // Generate QR code
  const otpauth = authenticator.keyuri(
    adminUser.email,
    'BLAZE Admin',
    secret
  );

  const qrCode = await QRCode.toDataURL(otpauth);

  // Store secret temporarily (not enabled yet)
  await supabaseAdmin
    .from('admin_users')
    .update({ totp_secret: secret })
    .eq('id', adminUser.id);

  await logAuditAction(adminUser.id, 'setup_2fa_start', 'admin_user', adminUser.id, null, null, {}, 'success');

  return NextResponse.json({
    success: true,
    secret,
    qrCode,
  });
}

/**
 * STEP 4: Confirm 2FA Setup
 */
async function handleConfirm2FA(request: NextRequest, data: any) {
  const { sessionToken, code } = data;

  if (!sessionToken || !code) {
    return NextResponse.json(
      { error: 'Session token and code required' },
      { status: 400 }
    );
  }

  const adminUser = await verifySession(sessionToken);
  if (!adminUser) {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    );
  }

  if (!adminUser.totp_secret) {
    return NextResponse.json(
      { error: '2FA setup not initiated' },
      { status: 400 }
    );
  }

  // Verify code
  const isValid = authenticator.verify({
    token: code,
    secret: adminUser.totp_secret,
  });

  if (!isValid) {
    await logAuditAction(adminUser.id, 'confirm_2fa', 'admin_user', adminUser.id, null, null, {}, 'failure', 'Invalid code');
    
    return NextResponse.json(
      { error: 'Invalid code. Please try again.' },
      { status: 401 }
    );
  }

  // Enable 2FA
  await supabaseAdmin
    .from('admin_users')
    .update({ totp_enabled: true })
    .eq('id', adminUser.id);

  await logAuditAction(adminUser.id, 'confirm_2fa', 'admin_user', adminUser.id, null, null, {}, 'success', '2FA enabled');

  return NextResponse.json({
    success: true,
    message: '2FA enabled successfully',
  });
}

/**
 * STEP 5: Logout
 */
async function handleLogout(request: NextRequest, data: any) {
  const { sessionToken } = data;

  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Session token required' },
      { status: 400 }
    );
  }

  // Invalidate session
  await supabaseAdmin
    .from('admin_sessions')
    .update({ is_valid: false })
    .eq('session_token', sessionToken);

  return NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });
}

/**
 * Helper: Verify session and get admin user
 */
async function verifySession(sessionToken: string): Promise<AdminUser | null> {
  const { data: session, error } = await supabaseAdmin
    .from('admin_sessions')
    .select('*, admin_users(*)')
    .eq('session_token', sessionToken)
    .eq('is_valid', true)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !session) {
    return null;
  }

  // Update last activity
  await supabaseAdmin
    .from('admin_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', session.id);

  return (session as any).admin_users;
}

/**
 * Helper: Log admin action to audit log
 */
async function logAuditAction(
  adminUserId: string | null,
  action: string,
  resourceType: string | null,
  resourceId: string | null,
  ip: string | null,
  userAgent: string | null,
  details: any,
  status: 'success' | 'failure' | 'blocked',
  errorMessage?: string
) {
  await supabaseAdmin
    .from('admin_audit_log')
    .insert({
      admin_user_id: adminUserId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      ip_address: ip,
      user_agent: userAgent,
      details,
      status,
      error_message: errorMessage,
    });
}

