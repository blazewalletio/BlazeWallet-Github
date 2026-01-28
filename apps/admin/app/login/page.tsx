'use client';

import { useState } from 'react';
import { Shield, Lock, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function AdminLogin() {
  const [step, setStep] = useState<'login' | '2fa' | 'setup-2fa'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code2FA, setCode2FA] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Step 1: Email + Password Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.requires2FA) {
        // User has 2FA enabled - go to verification
        setTempToken(data.tempToken);
        setStep('2fa');
      } else if (data.mustSetup2FA) {
        // First time login - setup 2FA
        setSessionToken(data.sessionToken);
        localStorage.setItem('admin_session', data.sessionToken);
        await initiate2FASetup(data.sessionToken);
      } else {
        // No 2FA (shouldn't happen, but handle it)
        localStorage.setItem('admin_session', data.sessionToken);
        window.location.href = '/';
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify 2FA Code
  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-2fa',
          tempToken,
          code: code2FA,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '2FA verification failed');
      }

      // Success - save session and redirect
      localStorage.setItem('admin_session', data.sessionToken);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Initiate 2FA Setup
  async function initiate2FASetup(token: string) {
    setLoading(true);
    try {
      const response = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setup-2fa',
          sessionToken: token,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '2FA setup failed');
      }

      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('setup-2fa');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 4: Confirm 2FA Setup
  async function handleConfirm2FA(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm-2fa',
          sessionToken,
          code: code2FA,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '2FA confirmation failed');
      }

      setSuccess('2FA enabled successfully! Redirecting...');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-4">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">BLAZE Admin</h1>
          <p className="text-gray-400">Secure authentication required</p>
        </div>

        {/* Login Form */}
        {step === 'login' && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    placeholder="admin@blazewallet.io"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs text-gray-400 text-center">
                🔒 Enterprise-grade security with 2FA
              </p>
            </div>
          </div>
        )}

        {/* 2FA Verification */}
        {step === '2fa' && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-full mb-3">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Two-Factor Authentication</h2>
              <p className="text-sm text-gray-400">Enter the 6-digit code from your authenticator app</p>
            </div>

            <form onSubmit={handleVerify2FA} className="space-y-6">
              <div>
                <input
                  type="text"
                  value={code2FA}
                  onChange={(e) => setCode2FA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-4 text-white text-center text-2xl tracking-widest placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                  placeholder="000000"
                  required
                  autoFocus
                  maxLength={6}
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code2FA.length !== 6}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('login');
                  setCode2FA('');
                  setError('');
                }}
                className="w-full text-gray-400 hover:text-white text-sm transition-colors"
              >
                ← Back to login
              </button>
            </form>
          </div>
        )}

        {/* 2FA Setup */}
        {step === 'setup-2fa' && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-full mb-3">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Setup Two-Factor Authentication</h2>
              <p className="text-sm text-gray-400">Scan this QR code with your authenticator app</p>
            </div>

            {qrCode && (
              <div className="bg-white rounded-lg p-4 mb-6">
                <img src={qrCode} alt="2FA QR Code" className="w-full" />
              </div>
            )}

            {secret && (
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-400 mb-2">Or enter this code manually:</p>
                <code className="text-sm text-white font-mono break-all">{secret}</code>
              </div>
            )}

            <form onSubmit={handleConfirm2FA} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Enter the 6-digit code to confirm
                </label>
                <input
                  type="text"
                  value={code2FA}
                  onChange={(e) => setCode2FA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-4 text-white text-center text-2xl tracking-widest placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                  placeholder="000000"
                  required
                  maxLength={6}
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-200">{success}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code2FA.length !== 6}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Confirming...' : 'Enable 2FA'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs text-gray-400 text-center">
                💡 Recommended apps: Google Authenticator, Authy, 1Password
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

