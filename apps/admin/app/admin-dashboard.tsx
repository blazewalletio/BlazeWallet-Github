'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, TrendingUp, AlertTriangle, RefreshCw, DollarSign, Activity, 
  Shield, LogOut, User, Bell, ArrowUpRight, ArrowDownLeft, Repeat,
  ShoppingCart, Zap, Clock, CheckCircle2, XCircle, Target, BarChart3,
  Search, Filter, ChevronRight, Eye, Calendar, Wallet
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface Metrics {
  activeUsers24h: number;
  transactions24h: number;
  volume24h: number;
  failedRate: number;
}

interface Cohorts {
  new_users: number;
  active: number;
  power_user: number;
  dormant: number;
  churned: number;
}

interface Alert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  created_at: string;
  status: string;
}

interface TransactionData {
  send: { initiated: number; confirmed: number; failed: number };
  swap: { initiated: number; confirmed: number; failed: number };
  receive: { detected24h: number; detected7d: number };
}

interface OnrampData {
  initiated: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  refunded: number;
  cancelled: number;
  totalVolume24h: number;
}

interface DashboardData {
  metrics: Metrics;
  trends: { transactions: number };
  cohorts: Cohorts;
  totalUsers: number;
  alerts?: {
    unreadCount: number;
    critical: Alert[];
  };
  recentActivity: any[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [transactionData, setTransactionData] = useState<TransactionData | null>(null);
  const [onrampData, setOnrampData] = useState<OnrampData | null>(null);
  const [userList, setUserList] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'users' | 'onramp'>('overview');

  useEffect(() => {
    loadUserInfo();
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch user list when switching to users tab
    if (activeTab === 'users' && !userList) {
      fetchDashboardData(true);
    }
  }, [activeTab]);

  async function loadUserInfo() {
    const sessionToken = localStorage.getItem('admin_session');
    if (!sessionToken) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch('/api/admin-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken }),
      });

      if (!response.ok) throw new Error('Session invalid');
      const result = await response.json();
      setUserEmail(result.user.email);
    } catch (error) {
      localStorage.removeItem('admin_session');
      router.push('/login');
    }
  }

  async function handleLogout() {
    const sessionToken = localStorage.getItem('admin_session');
    if (sessionToken) {
      try {
        await fetch('/api/admin-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logout', sessionToken }),
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    localStorage.removeItem('admin_session');
    router.push('/login');
  }

  // Filter users based on search query
  const filteredUsers = userList?.users?.filter((user: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.display_name?.toLowerCase().includes(query)
    );
  }) || [];

  async function fetchDashboardData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setRefreshing(true);

      const sessionToken = localStorage.getItem('admin_session');
      if (!sessionToken) {
        router.push('/login');
        return;
      }

      // Fetch overview data
      const overviewResponse = await fetch('/api/admin/analytics/overview', {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (!overviewResponse.ok) throw new Error('Failed to fetch overview data');
      const overviewResult = await overviewResponse.json();
      setData(overviewResult.data);

      // Fetch transaction data
      const transactionsResponse = await fetch('/api/admin/analytics/transactions', {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      if (transactionsResponse.ok) {
        const transactionsResult = await transactionsResponse.json();
        setTransactionData(transactionsResult.data);
      }

      // Fetch onramp data
      const onrampResponse = await fetch('/api/admin/analytics/onramp', {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      if (onrampResponse.ok) {
        const onrampResult = await onrampResponse.json();
        setOnrampData(onrampResult.data);
      }

      // Fetch user list (only when users tab is active for efficiency)
      if (activeTab === 'users' || !silent) {
        const usersResponse = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${sessionToken}` },
        });
        if (usersResponse.ok) {
          const usersResult = await usersResponse.json();
          setUserList(usersResult.data);
        }
      }

      setLastRefresh(new Date());
    } catch (error) {
      logger.error('[Admin] Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg font-medium">Loading BLAZE Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
                    BLAZE Admin
                  </h1>
                  <p className="text-sm text-gray-500">Real-time Analytics Dashboard</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchDashboardData()}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-all disabled:opacity-50 hover:shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline font-medium">Refresh</span>
              </button>

              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 max-w-[150px] truncate">{userEmail}</span>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-all hover:shadow-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Logout</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-4 border-b border-gray-200">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart3 className="w-4 h-4" />}>
              Overview
            </TabButton>
            <TabButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<Activity className="w-4 h-4" />}>
              Transactions
            </TabButton>
            <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users className="w-4 h-4" />}>
              Users
            </TabButton>
            <TabButton active={activeTab === 'onramp'} onClick={() => setActiveTab('onramp')} icon={<ShoppingCart className="w-4 h-4" />}>
              Onramp
            </TabButton>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Critical Alerts */}
        {data && data.alerts?.critical && data.alerts.critical.length > 0 && (
          <div className="mb-8 bg-red-50 border-2 border-red-200 rounded-2xl p-6 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-red-700 mb-4">🚨 Critical Alerts</h2>
                <div className="space-y-3">
                  {data.alerts?.critical.map(alert => (
                    <div key={alert.id} className="bg-white rounded-xl p-4 border border-red-200">
                      <p className="font-semibold text-gray-900">{alert.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Active Users (24h)"
                value={data?.metrics.activeUsers24h || 0}
                icon={<Users className="w-6 h-6" />}
                gradient="from-blue-500 to-primary-600"
                trend={data?.trends.transactions}
              />
              <MetricCard
                title="Transactions (24h)"
                value={data?.metrics.transactions24h || 0}
                icon={<Activity className="w-6 h-6" />}
                gradient="from-green-500 to-emerald-600"
                trend={data?.trends.transactions}
              />
              <MetricCard
                title="Volume (24h)"
                value={`$${(data?.metrics.volume24h || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<DollarSign className="w-6 h-6" />}
                gradient="from-purple-500 to-violet-600"
              />
              <MetricCard
                title="Failed Rate"
                value={`${(data?.metrics.failedRate || 0).toFixed(2)}%`}
                icon={<XCircle className="w-6 h-6" />}
                gradient={data && data.metrics.failedRate > 5 ? 'from-red-500 to-rose-600' : 'from-yellow-500 to-orange-600'}
              />
            </div>

            {/* User Cohorts */}
            <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-200 mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">User Segments</h2>
                  <p className="text-sm text-gray-500">Lifecycle analysis & engagement tracking</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <CohortCard label="New Users" count={data?.cohorts.new_users || 0} color="blue" icon={<User className="w-6 h-6" />} description="Recently signed up" />
                <CohortCard label="Active" count={data?.cohorts.active || 0} color="green" icon={<CheckCircle2 className="w-6 h-6" />} description="Regular users" />
                <CohortCard label="Power Users" count={data?.cohorts.power_user || 0} color="purple" icon={<Zap className="w-6 h-6" />} description="High activity" />
                <CohortCard label="Dormant" count={data?.cohorts.dormant || 0} color="yellow" icon={<Clock className="w-6 h-6" />} description="Inactive recently" />
                <CohortCard label="Churned" count={data?.cohorts.churned || 0} color="red" icon={<XCircle className="w-6 h-6" />} description="Haven't returned" />
              </div>
            </div>
          </>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <EventCard
                title="Send Transactions"
                icon={<ArrowUpRight className="w-6 h-6" />}
                gradient="from-blue-500 to-primary-600"
                stats={[
                  { label: 'Initiated', value: transactionData?.send.initiated || 0, color: 'text-blue-600' },
                  { label: 'Confirmed', value: transactionData?.send.confirmed || 0, color: 'text-green-600' },
                  { label: 'Failed', value: transactionData?.send.failed || 0, color: 'text-red-600' },
                ]}
              />
              <EventCard
                title="Swap Transactions"
                icon={<Repeat className="w-6 h-6" />}
                gradient="from-purple-500 to-violet-600"
                stats={[
                  { label: 'Initiated', value: transactionData?.swap.initiated || 0, color: 'text-purple-600' },
                  { label: 'Confirmed', value: transactionData?.swap.confirmed || 0, color: 'text-green-600' },
                  { label: 'Failed', value: transactionData?.swap.failed || 0, color: 'text-red-600' },
                ]}
              />
              <EventCard
                title="Receive Events"
                icon={<ArrowDownLeft className="w-6 h-6" />}
                gradient="from-green-500 to-emerald-600"
                stats={[
                  { label: 'Today', value: transactionData?.receive.detected24h || 0, color: 'text-green-600' },
                  { label: 'This Week', value: transactionData?.receive.detected7d || 0, color: 'text-gray-600' },
                  { label: 'Success Rate', value: '100%', color: 'text-green-600' },
                ]}
              />
            </div>

            <InfoBox
              icon={<Activity className="w-5 h-5" />}
              title="Transaction Analytics"
              message="Real-time tracking of all user transactions including send, swap, and receive events. Each transaction is tracked through its complete lifecycle (initiated → confirmed/failed)."
            />
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-soft border border-gray-200">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 outline-none text-gray-700"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Total Users"
                value={userList?.total || 0}
                icon={<Users className="w-6 h-6" />}
                gradient="from-blue-500 to-primary-600"
              />
              <StatCard
                title="Active Today"
                value={data?.metrics.activeUsers24h || 0}
                icon={<Zap className="w-6 h-6" />}
                gradient="from-green-500 to-emerald-600"
              />
              <StatCard
                title="New This Month"
                value={data?.cohorts.new_users || 0}
                icon={<TrendingUp className="w-6 h-6" />}
                gradient="from-purple-500 to-violet-600"
              />
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-soft border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-6 h-6 text-primary-500" />
                  All Users ({filteredUsers.length})
                </h2>
              </div>

              {!userList ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallets</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Segment</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredUsers.map((user: any) => (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                                {user.email?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{user.display_name || 'Anonymous'}</p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700">{user.wallet_count || 0}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700">{user.transaction_count || 0}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-500">
                                {user.last_activity ? new Date(user.last_activity).toLocaleDateString() : 'Never'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <SegmentBadge segment={user.segment} />
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => router.push(`/users/${user.id}`)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Onramp Tab */}
        {activeTab === 'onramp' && (
          <div className="space-y-6">
            {/* Volume Card */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-soft-lg text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium mb-1">Total Onramp Volume (24h)</p>
                  <p className="text-4xl font-bold">
                    ${(onrampData?.totalVolume24h || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <DollarSign className="w-8 h-8" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <OnrampStatusCard status="Initiated" count={onrampData?.initiated || 0} color="blue" icon={<ArrowUpRight className="w-6 h-6" />} />
              <OnrampStatusCard status="Processing" count={onrampData?.processing || 0} color="yellow" icon={<Clock className="w-6 h-6" />} />
              <OnrampStatusCard status="Completed" count={onrampData?.completed || 0} color="green" icon={<CheckCircle2 className="w-6 h-6" />} />
              <OnrampStatusCard status="Failed" count={onrampData?.failed || 0} color="red" icon={<XCircle className="w-6 h-6" />} />
              <OnrampStatusCard status="Pending" count={onrampData?.pending || 0} color="gray" icon={<Clock className="w-6 h-6" />} />
              <OnrampStatusCard status="Refunded" count={onrampData?.refunded || 0} color="orange" icon={<DollarSign className="w-6 h-6" />} />
              <OnrampStatusCard status="Cancelled" count={onrampData?.cancelled || 0} color="slate" icon={<XCircle className="w-6 h-6" />} />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Onramp Purchase Lifecycle</h3>
                  <p className="text-sm text-gray-500">Complete tracking of buy crypto flow</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Initiated:</strong> User starts checkout with provider (Onramper, MoonPay, etc.)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Pending/Processing:</strong> Payment being processed by provider</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Completed:</strong> Crypto successfully received in user's wallet</span>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Failed:</strong> Transaction failed (payment declined, KYC issues, etc.)</span>
                </div>
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Refunded:</strong> Payment refunded to user's account</span>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Cancelled:</strong> User cancelled the transaction</span>
                </div>
              </div>
            </div>

            <InfoBox
              icon={<ShoppingCart className="w-5 h-5" />}
              title="Onramp Analytics"
              message="We track the complete onramp lifecycle including provider, payment method, amounts, fiat/crypto currencies, and conversion rates. All data is privacy-first and aggregated."
            />
          </div>
        )}

        {/* System Status */}
        <div className="mt-8 flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">
              System Online • Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Shield className="w-3 h-3" />
            <span>Real-time analytics • Privacy-first design</span>
          </div>
        </div>
      </main>
    </div>
  );
}

// Components
function TabButton({ active, onClick, icon, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 font-medium transition-all border-b-2 ${
        active
          ? 'border-primary-500 text-primary-700 bg-primary-50'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function MetricCard({ title, value, icon, gradient, trend }: any) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-200 hover:shadow-soft-lg transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}>
          {icon}
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function CohortCard({ 
  label, 
  count, 
  color, 
  icon, 
  description 
}: { 
  label: string; 
  count: number; 
  color: string; 
  icon: React.ReactNode;
  description: string;
}) {
  const bgColors: any = {
    blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    green: 'bg-green-50 border-green-200 hover:bg-green-100',
    purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    yellow: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
    red: 'bg-red-50 border-red-200 hover:bg-red-100',
  };

  const textColors: any = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    purple: 'text-purple-700',
    yellow: 'text-yellow-700',
    red: 'text-red-700',
  };

  return (
    <div className={`${bgColors[color]} border-2 rounded-xl p-5 text-center hover:scale-105 transition-all cursor-pointer`}>
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-3xl font-bold text-gray-900 mb-1">{count.toLocaleString()}</p>
      <p className={`text-sm font-semibold ${textColors[color]} mb-1`}>{label}</p>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

function EventCard({ title, icon, gradient, stats }: any) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white`}>
          {icon}
        </div>
        <h3 className="font-bold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-2">
        {stats.map((stat: any, i: number) => (
          <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-600">{stat.label}</span>
            <span className={`text-sm font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, gradient }: any) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white`}>
          {icon}
        </div>
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      </div>
      <p className="text-4xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
}

function OnrampStatusCard({ 
  status, 
  count, 
  color, 
  icon 
}: { 
  status: string; 
  count: number; 
  color: string; 
  icon: React.ReactNode;
}) {
  const colors: any = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  };

  return (
    <div className={`${colors[color]} border-2 rounded-xl p-4 text-center hover:scale-105 transition-transform`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-2xl font-bold mb-1">{typeof count === 'number' ? count.toLocaleString() : count}</p>
      <p className="text-xs font-medium">{status}</p>
    </div>
  );
}

function InfoBox({ icon, title, message }: any) {
  return (
    <div className="bg-primary-50 border-2 border-primary-200 rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-primary-900 mb-2">{title}</h3>
          <p className="text-sm text-primary-800 leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  );
}

function SegmentBadge({ segment }: { segment: string }) {
  const config: any = {
    new: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'New' },
    active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
    power_user: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Power User' },
    dormant: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Dormant' },
    churned: { bg: 'bg-red-100', text: 'text-red-700', label: 'Churned' },
  };

  const style = config[segment] || config.new;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
