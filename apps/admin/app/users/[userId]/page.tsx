'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Wallet, Activity, DollarSign, TrendingUp, Clock,
  Shield, Eye, EyeOff, Copy, CheckCircle2, AlertCircle, Loader2,
  Send, Repeat, Download, ChevronDown, ChevronUp
} from 'lucide-react';
import { logger } from '@/lib/logger';

export default function UserDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.userId as string;

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBalances, setShowBalances] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [expandedChain, setExpandedChain] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  async function fetchUserData() {
    try {
      setLoading(true);
      const sessionToken = localStorage.getItem('admin_session');
      if (!sessionToken) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (!response.ok) throw new Error('Failed to fetch user data');
      const result = await response.json();
      setUserData(result.data);
    } catch (error) {
      logger.error('[Admin] Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBalances() {
    try {
      setLoadingBalances(true);
      const sessionToken = localStorage.getItem('admin_session');
      if (!sessionToken) return;

      const response = await fetch(`/api/admin/users/${userId}?balances=true`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (!response.ok) throw new Error('Failed to fetch balances');
      const result = await response.json();
      setUserData(result.data);
      setShowBalances(true);
    } catch (error) {
      logger.error('[Admin] Failed to fetch balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-700">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700">User not found</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>

        {/* User Profile Card */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-200 p-6">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
              {userData.profile.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {userData.profile.display_name || 'Anonymous User'}
              </h1>
              <p className="text-gray-600 mb-4">{userData.profile.email}</p>
              <div className="flex gap-4 text-sm text-gray-500">
                <div>
                  <span className="font-medium">User ID:</span> {userData.profile.id.substring(0, 8)}...
                </div>
                <div>
                  <span className="font-medium">Joined:</span> {new Date(userData.profile.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Transactions"
            value={userData.stats.total_transactions}
            icon={<Activity className="w-6 h-6" />}
            color="blue"
          />
          <StatCard
            title="Success Rate"
            value={`${userData.stats.success_rate}%`}
            icon={<CheckCircle2 className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title="Total Sends"
            value={userData.stats.send_count}
            icon={<Send className="w-6 h-6" />}
            color="purple"
          />
          <StatCard
            title="Total Swaps"
            value={userData.stats.swap_count}
            icon={<Repeat className="w-6 h-6" />}
            color="orange"
          />
        </div>

        {/* Wallets Section */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-primary-500" />
              Wallets ({userData.wallets.length})
            </h2>
            {!showBalances && userData.wallets.length > 0 && (
              <button
                onClick={fetchBalances}
                disabled={loadingBalances}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                {loadingBalances ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading Balances...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    View Balances
                  </>
                )}
              </button>
            )}
          </div>

          {userData.wallets.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No wallets found</p>
          ) : (
            <div className="space-y-4">
              {userData.wallets.map((wallet: any) => (
                <div key={wallet.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Wallet Address</p>
                      <p className="font-mono text-sm">{wallet.address}</p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(wallet.address)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Balances Section (if loaded) */}
        {showBalances && userData.balances && (
          <div className="bg-white rounded-2xl shadow-soft border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-500" />
              Portfolio: ${userData.balances.totalPortfolioUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h2>

            <div className="space-y-4">
              {userData.balances.chains.map((chain: any) => (
                <div key={chain.chain} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedChain(expandedChain === chain.chain ? null : chain.chain)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-gray-900">{chain.chainName}</div>
                      <div className="text-sm text-gray-500">
                        ${chain.totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {expandedChain === chain.chain ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {expandedChain === chain.chain && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
                      {/* Native Balance */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{chain.nativeBalance.symbol}</p>
                          <p className="text-sm text-gray-500">{chain.nativeBalance.balance}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${chain.nativeBalance.valueUSD.toFixed(2)}</p>
                          <p className="text-sm text-gray-500">${chain.nativeBalance.priceUSD.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Tokens */}
                      {chain.tokens.length > 0 && (
                        <div className="border-t border-gray-200 pt-3 space-y-2">
                          <p className="text-sm font-medium text-gray-700">Tokens</p>
                          {chain.tokens.map((token: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <div>
                                <p className="font-medium">{token.symbol}</p>
                                <p className="text-gray-500">{parseFloat(token.balance).toFixed(4)}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">${token.valueUSD.toFixed(2)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-soft border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary-500" />
            Recent Transactions ({userData.transactions.length})
          </h2>

          {userData.transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {userData.transactions.slice(0, 20).map((tx: any) => (
                <div key={tx.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium capitalize">{tx.event_type.replace('_', ' ')}</span>
                        <StatusBadge status={tx.status} />
                      </div>
                      <p className="text-sm text-gray-500">
                        {tx.amount ? `${tx.amount} ${tx.symbol || ''}` : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                    {tx.tx_hash && (
                      <button
                        onClick={() => navigator.clipboard.writeText(tx.tx_hash)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  const colors: any = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 bg-gradient-to-br ${colors[color]} rounded-xl flex items-center justify-center text-white`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: any = {
    success: { bg: 'bg-green-100', text: 'text-green-700' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    failed: { bg: 'bg-red-100', text: 'text-red-700' },
  };

  const style = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {status}
    </span>
  );
}

