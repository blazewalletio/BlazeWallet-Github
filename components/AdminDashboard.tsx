'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { logger } from '@/lib/logger';
import { 
  Users, 
  CheckCircle, 
  Gift, 
  Sparkles,
  Trophy,
  Mail,
  Download,
  Trash2,
  Loader2,
  Filter,
  Search,
  Send
} from 'lucide-react';

interface Registration {
  id: string;
  wallet_address: string;
  email: string | null;
  telegram: string | null;
  twitter: string | null;
  position: number;
  registered_at: string;
  is_verified: boolean;
  is_early_bird: boolean;
  referral_code: string;
  referred_by: string | null;
  email_verified_at: string | null;
}

interface AdminData {
  registrations: Registration[];
  stats: any;
  leaderboard: any[];
}

export default function AdminDashboard() {
  const [adminEmail, setAdminEmail] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [data, setData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'unverified' | 'early_bird'>('all');

  // Load admin data
  const loadAdminData = async () => {
    if (!adminEmail) {
      logger.log('❌ No admin email provided');
      return;
    }

    logger.log('🔐 Attempting admin login with email:', adminEmail);
    setIsLoading(true);
    setError('');
    
    try {
      const url = `/api/priority-list/admin?admin=${encodeURIComponent(adminEmail)}`;
      logger.log('📡 Fetching admin data from:', url);
      
      const response = await fetch(url);
      logger.log('📥 Response status:', response.status);
      
      const result = await response.json();
      logger.log('📦 Response data:', result);
      
      if (result.success) {
        logger.log('✅ Admin authorization successful!');
        setData(result.data);
        setIsAuthorized(true);
      } else {
        logger.log('❌ Admin authorization failed:', result.message);
        setError(result.message || 'Unauthorized');
        setIsAuthorized(false);
      }
    } catch (err) {
      logger.error('💥 Error loading admin data:', err);
      setError('Failed to load admin data');
      setIsAuthorized(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify registration
  const handleVerify = async (walletAddress: string) => {
    try {
      const response = await fetch('/api/priority-list/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail,
          action: 'verify',
          walletAddress,
        }),
      });

      const result = await response.json();
      if (result.success) {
        loadAdminData(); // Reload data
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to verify registration');
    }
  };

  // Delete registration
  const handleDelete = async (walletAddress: string) => {
    if (!confirm('Are you sure you want to delete this registration?')) return;

    try {
      const response = await fetch('/api/priority-list/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail,
          action: 'delete',
          walletAddress,
        }),
      });

      const result = await response.json();
      if (result.success) {
        loadAdminData(); // Reload data
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to delete registration');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!data?.registrations) return;

    const csv = [
      ['Position', 'Wallet', 'Email', 'Telegram', 'Twitter', 'Registered', 'Verified', 'Early Bird', 'Referral Code', 'Referred By'].join(','),
      ...filteredRegistrations.map(r => [
        r.position,
        r.wallet_address,
        r.email || '',
        r.telegram || '',
        r.twitter || '',
        new Date(r.registered_at).toLocaleString(),
        r.is_verified ? 'Yes' : 'No',
        r.is_early_bird ? 'Yes' : 'No',
        r.referral_code,
        r.referred_by || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blaze-priority-list-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Filter registrations
  const filteredRegistrations = data?.registrations.filter(r => {
    const matchesSearch = 
      r.wallet_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.email && r.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.referral_code && r.referral_code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'verified' && r.is_verified) ||
      (filterStatus === 'unverified' && !r.is_verified) ||
      (filterStatus === 'early_bird' && r.is_early_bird);

    return matchesSearch && matchesFilter;
  }) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-soft-xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-yellow-500 px-6 py-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-white/90 mt-1">Priority List Management</p>
              </div>
            </div>
          </div>

              <div className="p-6 space-y-6">
                {/* Admin Login */}
                {!isAuthorized && (
                  <div className="max-w-md mx-auto space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Admin Access</h3>
                    <input aria-label="Email address"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@blazewallet.io"
                      className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-orange-500 focus:outline-none"
                      onKeyPress={(e) => e.key === 'Enter' && loadAdminData()}
                    />
                    <button
                      onClick={loadAdminData}
                      disabled={isLoading || !adminEmail}
                      className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          Access Dashboard
                        </>
                      )}
                    </button>
                    {error && (
                      <div className="text-sm text-red-600 text-center">{error}</div>
                    )}
                  </div>
                )}

                {/* Admin Dashboard Content */}
                {isAuthorized && data && (
                  <>
                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <Users className="w-6 h-6 text-blue-500 mb-2" />
                        <div className="text-3xl font-bold text-gray-900">{data.stats?.total_registered || 0}</div>
                        <div className="text-sm text-gray-600">Total Registered</div>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <CheckCircle className="w-6 h-6 text-green-500 mb-2" />
                        <div className="text-3xl font-bold text-gray-900">{data.stats?.verified_count || 0}</div>
                        <div className="text-sm text-gray-600">Verified</div>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <Sparkles className="w-6 h-6 text-yellow-500 mb-2" />
                        <div className="text-3xl font-bold text-gray-900">{data.stats?.early_bird_count || 0}</div>
                        <div className="text-sm text-gray-600">Early Birds</div>
                      </div>

                      <div className="bg-purple-50 border border-orange-200 rounded-xl p-4">
                        <Gift className="w-6 h-6 text-purple-500 mb-2" />
                        <div className="text-3xl font-bold text-gray-900">{data.stats?.referral_count || 0}</div>
                        <div className="text-sm text-gray-600">Referrals</div>
                      </div>
                    </div>

                    {/* Top Referrers */}
                    {data.leaderboard && data.leaderboard.length > 0 && (
                      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Trophy className="w-5 h-5 text-orange-500" />
                          <h3 className="font-semibold text-gray-900">Top Referrers</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {data.leaderboard.slice(0, 3).map((leader, idx) => (
                            <div key={leader.wallet_address} className="bg-white rounded-lg p-3 flex items-center gap-3">
                              <div className={`text-2xl ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}`}>
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                              </div>
                              <div>
                                <div className="font-mono text-sm text-gray-900">
                                  {leader.wallet_address.slice(0, 6)}...{leader.wallet_address.slice(-4)}
                                </div>
                                <div className="text-xs text-gray-600">{leader.referral_count} referrals</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filters & Actions */}
                    <div className="flex flex-wrap gap-3 items-center justify-between">
                      <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input aria-label="Text input"
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search wallet, email, code..."
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-xl border border-gray-200 focus:border-orange-500 focus:outline-none text-sm"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setFilterStatus('all')}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            filterStatus === 'all' 
                              ? 'bg-gray-900 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setFilterStatus('verified')}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            filterStatus === 'verified' 
                              ? 'bg-green-500 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Verified
                        </button>
                        <button
                          onClick={() => setFilterStatus('unverified')}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            filterStatus === 'unverified' 
                              ? 'bg-orange-500 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Unverified
                        </button>
                        <button
                          onClick={() => setFilterStatus('early_bird')}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            filterStatus === 'early_bird' 
                              ? 'bg-yellow-500 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Early Birds
                        </button>
                      </div>

                      <button
                        onClick={exportToCSV}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold flex items-center gap-2 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Export CSV
                      </button>
                    </div>

                    {/* Registrations Table */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredRegistrations.map((reg) => (
                              <tr key={reg.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-orange-600">
                                  #{reg.position}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                                  {reg.wallet_address.slice(0, 6)}...{reg.wallet_address.slice(-4)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {reg.email ? (
                                    <div className="flex items-center gap-1">
                                      <Mail className="w-3 h-3" />
                                      {reg.email}
                                      {reg.email_verified_at && <CheckCircle className="w-3 h-3 text-green-500" />}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                                  {reg.referral_code}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {new Date(reg.registered_at).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                  <div className="flex gap-1">
                                    {reg.is_verified && (
                                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                        Verified
                                      </span>
                                    )}
                                    {reg.is_early_bird && (
                                      <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
                                        🎉 Early Bird
                                      </span>
                                    )}
                                    {!reg.is_verified && !reg.is_early_bird && (
                                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex justify-end gap-2">
                                    {!reg.is_verified && (
                                      <button
                                        onClick={() => handleVerify(reg.wallet_address)}
                                        className="text-green-600 hover:text-green-700 font-semibold"
                                      >
                                        Verify
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDelete(reg.wallet_address)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {filteredRegistrations.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          No registrations found
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 text-center">
                      Showing {filteredRegistrations.length} of {data.registrations.length} registrations
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </div>
  );
}

