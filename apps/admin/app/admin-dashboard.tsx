'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, TrendingUp, AlertTriangle, RefreshCw, DollarSign, Activity, 
  Shield, LogOut, User, Bell, ArrowUpRight, ArrowDownLeft, Repeat,
  ShoppingCart, Zap, Clock, CheckCircle2, XCircle, Target, BarChart3,
  Search, Filter, ChevronRight, Eye, Calendar, Wallet, Mail, X
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
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'users' | 'onramp' | 'emails'>('overview');

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
            <TabButton active={activeTab === 'emails'} onClick={() => setActiveTab('emails')} icon={<Mail className="w-4 h-4" />}>
              Emails
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

        {/* Emails Tab */}
        {activeTab === 'emails' && (
          <EmailsTab />
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

// Emails Tab Component
function EmailsTab() {
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<string | null>(null);

  const emails = [
    {
      id: 'welcome-verification',
      name: 'Welcome & Email Verification',
      description: 'Sent when user signs up with email wallet. Includes verification link.',
      subject: '🔥 Welcome to BLAZE Wallet - Verify Your Email',
      location: 'lib/email-template.ts',
      function: 'generateWalletStyleEmail',
      apiRoutes: ['/api/send-welcome-email', '/api/auth/resend-verification'],
      code: `// File: lib/email-template.ts
export function generateWalletStyleEmail(data: WalletWelcomeEmailParams): string {
  const { verificationLink } = data;
  const logoUrl = \`\${ASSET_BASE_URL}/icons/icon-512x512.png\`;

  return \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BLAZE Wallet</title>
  <!--[if mso]>
    <style type="text/css">
      body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      img {border: 0 !important; outline: none !important; text-decoration: none !important;}
    </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background: white; box-shadow: 0 2px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 48px 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 24px; border-bottom: 2px solid #f97316;">
                    <img src="\${logoUrl}" alt="BLAZE Wallet" width="56" height="56" style="display: block; border-radius: 12px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 0 48px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 38px; font-weight: 700; color: #111827; line-height: 1.2; letter-spacing: -0.02em;">
                Welcome to the new era of crypto
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <p style="margin: 0 0 20px; font-size: 19px; line-height: 1.7; color: #374151;">
                Thank you for choosing BLAZE—the most advanced multi-chain wallet built for serious crypto users who demand more.
              </p>
              
              <p style="margin: 0 0 20px; font-size: 19px; line-height: 1.7; color: #374151;">
                You're joining thousands of users who've discovered that managing crypto doesn't have to be complicated, insecure, or unrewarding. With BLAZE, you get the perfect balance: enterprise-level security meets consumer-grade simplicity.
              </p>

              <p style="margin: 0; font-size: 19px; line-height: 1.7; color: #374151;">
                Here's what sets us apart from every other wallet on the market:
              </p>
            </td>
          </tr>

          <!-- Features -->
          <tr>
            <td style="padding: 0 48px 48px;">
              
              <!-- Feature 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 36px; padding-bottom: 36px; border-bottom: 1px solid #f3f4f6;">
                <tr>
                  <td width="80" valign="top" style="padding-right: 20px;">
                    <div style="font-size: 32px; font-weight: 800; color: #3b82f6; opacity: 0.3; font-family: monospace;">01</div>
                  </td>
                  <td>
                    <h3 style="margin: 0 0 12px; font-size: 21px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">
                      True multi-chain freedom
                    </h3>
                    <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280;">
                      Stop juggling multiple wallets. BLAZE natively supports 18+ blockchains including Ethereum, Bitcoin, Solana, Polygon, Arbitrum, Optimism, and more. One seed phrase. One interface. Total control.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Feature 2 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 36px; padding-bottom: 36px; border-bottom: 1px solid #f3f4f6;">
                <tr>
                  <td width="80" valign="top" style="padding-right: 20px;">
                    <div style="font-size: 32px; font-weight: 800; color: #8b5cf6; opacity: 0.3; font-family: monospace;">02</div>
                  </td>
                  <td>
                    <h3 style="margin: 0 0 12px; font-size: 21px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">
                      AI-powered intelligence
                    </h3>
                    <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280;">
                      Our AI doesn't just sit there—it actively protects you from scams, suggests portfolio optimizations, schedules transactions during low-gas periods, and provides insights that help you make smarter decisions.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Feature 3 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 36px; padding-bottom: 36px; border-bottom: 1px solid #f3f4f6;">
                <tr>
                  <td width="80" valign="top" style="padding-right: 20px;">
                    <div style="font-size: 32px; font-weight: 800; color: #10b981; opacity: 0.3; font-family: monospace;">03</div>
                  </td>
                  <td>
                    <h3 style="margin: 0 0 12px; font-size: 21px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">
                      Rewards that actually matter
                    </h3>
                    <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280;">
                      Earn 2% cashback in BLAZE tokens on every transaction. Stake your tokens for up to 20% APY. Participate in governance. Most wallets take from you—BLAZE gives back.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Feature 4 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="80" valign="top" style="padding-right: 20px;">
                    <div style="font-size: 32px; font-weight: 800; color: #f59e0b; opacity: 0.3; font-family: monospace;">04</div>
                  </td>
                  <td>
                    <h3 style="margin: 0 0 12px; font-size: 21px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">
                      Security without compromise
                    </h3>
                    <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280;">
                      Face ID, hardware encryption, WebAuthn, optional hardware wallet integration. Your private keys never leave your device. We have zero access to your funds. Ever.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Verification CTA -->
          \${verificationLink ? \`
          <tr>
            <td style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); padding: 48px; text-align: center;">
              <h2 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">
                Ready to get started?
              </h2>
              <p style="margin: 0 0 32px; font-size: 17px; line-height: 1.6; color: #78350f; max-width: 480px; margin-left: auto; margin-right: auto;">
                First, let's verify your email address to ensure your account is secure and you can access all features.
              </p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: #111827; border-radius: 10px;">
                    <a href="\${verificationLink}" style="display: block; padding: 18px 48px; color: white; text-decoration: none; font-weight: 600; font-size: 17px; letter-spacing: -0.01em;">
                      Verify email address →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; font-size: 14px; color: #92400e;">
                Verification link expires in 24 hours
              </p>
            </td>
          </tr>
          \` : ''}

          <!-- Getting Started -->
          <tr>
            <td style="padding: 48px;">
              <h3 style="margin: 0 0 28px; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">
                Your BLAZE journey in 4 steps
              </h3>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 24px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 20px;" valign="top">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); border-radius: 8px; color: white; font-weight: 700; font-size: 16px; text-align: center; line-height: 36px;">1</div>
                        </td>
                        <td style="padding-top: 2px;">
                          <div style="font-size: 17px; font-weight: 600; color: #111827; margin-bottom: 6px;">Verify your email</div>
                          <div style="font-size: 16px; color: #6b7280; line-height: 1.6;">Click the button above to activate your account</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-bottom: 24px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 20px;" valign="top">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); border-radius: 8px; color: white; font-weight: 700; font-size: 16px; text-align: center; line-height: 36px;">2</div>
                        </td>
                        <td style="padding-top: 2px;">
                          <div style="font-size: 17px; font-weight: 600; color: #111827; margin-bottom: 6px;">Add your first assets</div>
                          <div style="font-size: 16px; color: #6b7280; line-height: 1.6;">Transfer from an exchange, buy with a card, or receive from another wallet</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-bottom: 24px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 20px;" valign="top">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); border-radius: 8px; color: white; font-weight: 700; font-size: 16px; text-align: center; line-height: 36px;">3</div>
                        </td>
                        <td style="padding-top: 2px;">
                          <div style="font-size: 17px; font-weight: 600; color: #111827; margin-bottom: 6px;">Explore AI features</div>
                          <div style="font-size: 16px; color: #6b7280; line-height: 1.6;">Let our Portfolio Advisor analyze your holdings and suggest optimizations</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 20px;" valign="top">
                          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); border-radius: 8px; color: white; font-weight: 700; font-size: 16px; text-align: center; line-height: 36px;">4</div>
                        </td>
                        <td style="padding-top: 2px;">
                          <div style="font-size: 17px; font-weight: 600; color: #111827; margin-bottom: 6px;">Activate rewards</div>
                          <div style="font-size: 16px; color: #6b7280; line-height: 1.6;">Enable staking to start earning up to 20% APY on BLAZE tokens</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="background: #fafafa; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 17px; line-height: 1.7; color: #374151;">
                Questions? Our support team is available 24/7
              </p>
              <a href="mailto:support@blazewallet.io" style="font-size: 17px; font-weight: 600; color: #f97316; text-decoration: none;">
                support@blazewallet.io
              </a>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding: 40px 48px;">
              <p style="margin: 0 0 8px; font-size: 18px; color: #374151;">
                Welcome aboard,
              </p>
              <p style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">
                The BLAZE team
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #111827; padding: 32px 48px; text-align: center;">
              <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 600; color: white; margin-bottom: 6px; letter-spacing: 0.5px;">
                  BLAZE WALLET
                </div>
                <div style="font-size: 13px; color: #9ca3af;">
                  The future of multi-chain crypto management
                </div>
              </div>
              
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/wallet" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Wallet</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/about" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">About</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/security" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Security</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/support" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Support</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/privacy" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Privacy policy</a></td>
                </tr>
              </table>
              
              <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
                © 2025 BLAZE Wallet. All rights reserved.<br />
                This email was sent because you created an account at my.blazewallet.io
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
\`;
}`
    },
    {
      id: 'device-verification-code',
      name: 'Device Verification Code (6-digit)',
      description: 'Sent when user needs to verify a new device with a 6-digit code.',
      subject: '🔐 Device Verification Code - BLAZE Wallet',
      location: 'app/api/device-verification-code/route.ts',
      function: 'generateVerificationCodeEmail',
      apiRoutes: ['/api/device-verification-code'],
      code: `// File: app/api/device-verification-code/route.ts
function generateVerificationCodeEmail(deviceName: string, code: string, location?: string): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const logoUrl = \`\${ASSET_BASE_URL}/icons/icon-512x512.png\`;

  return \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Device Verification Code - BLAZE Wallet</title>
  <!--[if mso]>
    <style type="text/css">
      body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      img {border: 0 !important; outline: none !important; text-decoration: none !important;}
    </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background: white; box-shadow: 0 2px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 48px 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 24px; border-bottom: 2px solid #f97316;">
                    <img src="\${logoUrl}" alt="BLAZE Wallet" width="56" height="56" style="display: block; border-radius: 12px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 0 48px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 38px; font-weight: 700; color: #111827; line-height: 1.2; letter-spacing: -0.02em;">
                Device Verification Code
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin-bottom: 32px; border-radius: 8px;">
                <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: 600;">🔐 Security Verification</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 16px; line-height: 1.6;">A login attempt was made from a new device. Please verify this device with the code below.</p>
              </div>
            </td>
          </tr>

          <!-- Verification Code -->
          <tr>
            <td style="padding: 0 48px 48px;">
              <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 2px solid #f97316; border-radius: 12px; padding: 40px; margin-bottom: 32px; text-align: center;">
                <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #78350f;">Enter this code to verify:</p>
                <div style="font-size: 48px; font-weight: 700; color: #f97316; letter-spacing: 12px; font-family: 'Courier New', monospace; margin: 20px 0;">
                  \${code}
                </div>
                <p style="margin: 16px 0 0; font-size: 14px; color: #92400e;">Code expires in 10 minutes</p>
              </div>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <p style="margin: 0 0 12px; font-size: 16px; color: #374151; line-height: 1.6;">
                  <strong style="color: #111827;">Device:</strong> \${deviceName}
                </p>
                \${location ? \`<p style="margin: 0 0 12px; font-size: 16px; color: #374151; line-height: 1.6;">
                  <strong style="color: #111827;">Location:</strong> \${location}
                </p>\` : ''}
                <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6;">
                  <strong style="color: #111827;">Time:</strong> \${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              </div>
              
              <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0; font-size: 16px; color: #92400e; line-height: 1.6;">
                  <strong>⚠️ Didn't attempt to log in?</strong> If you didn't try to access your wallet from this device, please ignore this email or contact support immediately.
                </p>
              </div>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280; text-align: center;">
                After entering this code, you'll be asked to provide your 2FA code from your authenticator app.
              </p>
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="background: #fafafa; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 17px; line-height: 1.7; color: #374151;">
                Questions? Our support team is available 24/7
              </p>
              <a href="mailto:support@blazewallet.io" style="font-size: 17px; font-weight: 600; color: #f97316; text-decoration: none;">
                support@blazewallet.io
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #111827; padding: 32px 48px; text-align: center;">
              <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 600; color: white; margin-bottom: 6px; letter-spacing: 0.5px;">
                  BLAZE WALLET
                </div>
                <div style="font-size: 13px; color: #9ca3af;">
                  The future of multi-chain crypto management
                </div>
              </div>
              
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/wallet" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Wallet</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/about" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">About</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/security" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Security</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/support" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Support</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/privacy" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Privacy policy</a></td>
                </tr>
              </table>
              
              <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
                © \${new Date().getFullYear()} BLAZE Wallet. All rights reserved.<br />
                This email was sent because you created an account at my.blazewallet.io
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  \`.trim();
}`
    },
    {
      id: 'device-verification-link',
      name: 'Device Verification Link',
      description: 'Sent when user needs to verify a new device via link (legacy flow).',
      subject: '🔐 New Device Login - BLAZE Wallet',
      location: 'app/api/verify-device/route.ts',
      function: 'generateDeviceVerificationEmail',
      apiRoutes: ['/api/verify-device'],
      code: `// File: app/api/verify-device/route.ts
function generateDeviceVerificationEmail(deviceName: string, verificationLink: string, location?: string): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const logoUrl = \`\${ASSET_BASE_URL}/icons/icon-512x512.png\`;
  
  return \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Device Login - BLAZE Wallet</title>
  <!--[if mso]>
    <style type="text/css">
      body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      img {border: 0 !important; outline: none !important; text-decoration: none !important;}
    </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background: white; box-shadow: 0 2px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 48px 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 24px; border-bottom: 2px solid #f97316;">
                    <img src="\${logoUrl}" alt="BLAZE Wallet" width="56" height="56" style="display: block; border-radius: 12px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 0 48px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 38px; font-weight: 700; color: #111827; line-height: 1.2; letter-spacing: -0.02em;">
                New Device Login Detected
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin-bottom: 32px; border-radius: 8px;">
                <p style="margin: 0; color: #92400e; font-size: 16px; font-weight: 600;">🔐 Security Alert</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 16px; line-height: 1.6;">We detected a login from a new device. Please verify this device to add it to your trusted devices list.</p>
              </div>
            </td>
          </tr>

          <!-- Device Details -->
          <tr>
            <td style="padding: 0 48px 48px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">Device Details</h2>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <p style="margin: 0 0 12px; font-size: 16px; color: #374151; line-height: 1.6;">
                  <strong style="color: #111827;">Device:</strong> \${deviceName}
                </p>
                \${location ? \`<p style="margin: 0 0 12px; font-size: 16px; color: #374151; line-height: 1.6;">
                  <strong style="color: #111827;">Location:</strong> \${location}
                </p>\` : ''}
                <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6;">
                  <strong style="color: #111827;">Time:</strong> \${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              </div>
              
              <p style="margin: 0 0 32px; font-size: 17px; line-height: 1.7; color: #374151;">
                If this was you, please verify this device by clicking the button below. This will add it to your trusted devices list.
              </p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 32px;">
                <tr>
                  <td style="background: #111827; border-radius: 10px;">
                    <a href="\${verificationLink}" style="display: block; padding: 18px 48px; color: white; text-decoration: none; font-weight: 600; font-size: 17px; letter-spacing: -0.01em;">
                      Verify This Device →
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #92400e;">⚠️ Wasn't you?</p>
                <p style="margin: 0 0 12px; font-size: 16px; color: #78350f; line-height: 1.6;">
                  If you didn't attempt to log in, your account may be compromised. Please:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 16px; line-height: 1.8;">
                  <li>Change your password immediately</li>
                  <li>Enable two-factor authentication</li>
                  <li>Review your trusted devices</li>
                  <li>Contact support if needed</li>
                </ul>
              </div>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #6b7280; text-align: center;">
                This verification link will expire in <strong>24 hours</strong>. Unverified devices will be automatically removed.
              </p>
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="background: #fafafa; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 17px; line-height: 1.7; color: #374151;">
                Questions? Our support team is available 24/7
              </p>
              <a href="mailto:support@blazewallet.io" style="font-size: 17px; font-weight: 600; color: #f97316; text-decoration: none;">
                support@blazewallet.io
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #111827; padding: 32px 48px; text-align: center;">
              <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 600; color: white; margin-bottom: 6px; letter-spacing: 0.5px;">
                  BLAZE WALLET
                </div>
                <div style="font-size: 13px; color: #9ca3af;">
                  The future of multi-chain crypto management
                </div>
              </div>
              
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/wallet" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Wallet</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/about" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">About</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/security" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Security</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/support" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Support</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/privacy" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Privacy policy</a></td>
                </tr>
              </table>
              
              <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
                © \${new Date().getFullYear()} BLAZE Wallet. All rights reserved.<br />
                This email was sent because you created an account at my.blazewallet.io
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  \`.trim();
}`
    },
    {
      id: 'device-verification-service',
      name: 'Device Verification Email (via email-service)',
      description: 'Alternative device verification email template in email-service.ts (used by sendDeviceVerificationEmail function).',
      subject: '🔐 Verify Your New Device - BLAZE Wallet',
      location: 'lib/email-service.ts',
      function: 'getDeviceVerificationEmailHTML',
      apiRoutes: ['Used by sendDeviceVerificationEmail()'],
      code: `// File: lib/email-service.ts
function getDeviceVerificationEmailHTML(
  code: string,
  deviceInfo: {
    deviceName: string;
    location: string;
    ipAddress: string;
    browser: string;
    os: string;
  }
): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const logoUrl = \`\${ASSET_BASE_URL}/icons/icon-512x512.png\`;

  return \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Device - BLAZE Wallet</title>
  <!--[if mso]>
    <style type="text/css">
      body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      img {border: 0 !important; outline: none !important; text-decoration: none !important;}
    </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background: white; box-shadow: 0 2px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 48px 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 24px; border-bottom: 2px solid #f97316;">
                    <img src="\${logoUrl}" alt="BLAZE Wallet" width="56" height="56" style="display: block; border-radius: 12px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 0 48px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 38px; font-weight: 700; color: #111827; line-height: 1.2; letter-spacing: -0.02em;">
                Verify Your Device
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <p style="margin: 0 0 32px; font-size: 19px; line-height: 1.7; color: #374151;">
                We detected a login attempt from a new device. To keep your wallet secure, please verify this device with the code below.
              </p>
            </td>
          </tr>

          <!-- Verification Code -->
          <tr>
            <td style="padding: 0 48px 48px;">
              <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 2px solid #f97316; border-radius: 12px; padding: 40px; margin-bottom: 32px; text-align: center;">
                <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #78350f;">Your Verification Code</p>
                <div style="font-size: 48px; font-weight: 700; color: #f97316; letter-spacing: 12px; font-family: 'Courier New', monospace; margin: 20px 0;">
                  \${code}
                </div>
                <p style="margin: 16px 0 0; font-size: 14px; color: #92400e;">Valid for 15 minutes</p>
              </div>
              
              <p style="margin: 0 0 32px; font-size: 17px; line-height: 1.7; color: #374151;">
                After entering this code, you'll be asked to provide your 2FA code from your authenticator app.
              </p>
              
              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">Device Details</h2>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="120" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">Device:</td>
                          <td style="color: #111827; font-size: 16px;">\${deviceInfo.deviceName}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="120" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">Browser:</td>
                          <td style="color: #111827; font-size: 16px;">\${deviceInfo.browser}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="120" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">OS:</td>
                          <td style="color: #111827; font-size: 16px;">\${deviceInfo.os}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="120" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">Location:</td>
                          <td style="color: #111827; font-size: 16px;">\${deviceInfo.location}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="120" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">IP Address:</td>
                          <td style="color: #111827; font-size: 16px;">\${deviceInfo.ipAddress}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #92400e;">⚠️ Didn't try to log in?</p>
                <p style="margin: 0; font-size: 16px; color: #78350f; line-height: 1.6;">
                  If you didn't attempt to access your wallet from this device, someone may be trying to access your account. Please change your password immediately and enable additional security measures.
                </p>
              </div>
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="background: #fafafa; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 17px; line-height: 1.7; color: #374151;">
                Questions? Our support team is available 24/7
              </p>
              <a href="mailto:support@blazewallet.io" style="font-size: 17px; font-weight: 600; color: #f97316; text-decoration: none;">
                support@blazewallet.io
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #111827; padding: 32px 48px; text-align: center;">
              <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 600; color: white; margin-bottom: 6px; letter-spacing: 0.5px;">
                  BLAZE WALLET
                </div>
                <div style="font-size: 13px; color: #9ca3af;">
                  The future of multi-chain crypto management
                </div>
              </div>
              
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/wallet" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Wallet</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/about" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">About</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/security" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Security</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/support" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Support</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/privacy" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Privacy policy</a></td>
                </tr>
              </table>
              
              <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
                © \${new Date().getFullYear()} BLAZE Wallet. All rights reserved.<br />
                This email was sent because you created an account at my.blazewallet.io
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  \`;
}`
    },
    {
      id: 'security-alert',
      name: 'Security Alert Email',
      description: 'Sent for suspicious login attempts, new device logins, or password changes. Fully implemented with uniform styling.',
      subject: '🚨 Suspicious Login Blocked - BLAZE Wallet | 🔔 New Device Login - BLAZE Wallet | ✅ Password Changed - BLAZE Wallet',
      location: 'app/api/security-alert/route.ts',
      function: 'sendSecurityAlertEmail',
      apiRoutes: ['/api/security-alert'],
      code: `// File: app/api/security-alert/route.ts
function generateSecurityAlertEmail(
  alertType: string,
  deviceInfo: {
    deviceName: string;
    location: { city: string; country: string };
    ipAddress: string;
    riskScore: number;
    isTor: boolean;
    isVPN: boolean;
    browser: string;
    os: string;
  }
): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const logoUrl = \`\${ASSET_BASE_URL}/icons/icon-512x512.png\`;

  // Format alert message based on type
  let title = '';
  let message = '';
  let action = '';
  let alertColor = '#f97316';
  let alertBg = '#fff7ed';
  let alertBorder = '#f97316';
  
  switch (alertType) {
    case 'suspicious_login_blocked':
      title = '🚨 Suspicious Login Blocked';
      message = \`We blocked a suspicious login attempt to your BLAZE Wallet account from a high-risk device (Risk Score: \${deviceInfo.riskScore}/100).\`;
      action = 'If this was you, please contact support. If not, your account is safe.';
      alertColor = '#dc2626';
      alertBg = '#fee2e2';
      alertBorder = '#dc2626';
      break;
    case 'new_device_login':
      title = '🔔 New Device Detected';
      message = 'A new device was used to access your BLAZE Wallet account.';
      action = 'If this wasn\\'t you, change your password immediately and contact support.';
      alertColor = '#f59e0b';
      alertBg = '#fef3c7';
      alertBorder = '#f59e0b';
      break;
    case 'password_changed':
      title = '✅ Password Changed';
      message = 'Your BLAZE Wallet password was successfully changed.';
      action = 'If you didn\\'t make this change, contact support immediately.';
      alertColor = '#10b981';
      alertBg = '#d1fae5';
      alertBorder = '#10b981';
      break;
  }

  return \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Alert - BLAZE Wallet</title>
  <!--[if mso]>
    <style type="text/css">
      body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      img {border: 0 !important; outline: none !important; text-decoration: none !important;}
    </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background: white; box-shadow: 0 2px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 48px 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 24px; border-bottom: 2px solid #f97316;">
                    <img src="\${logoUrl}" alt="BLAZE Wallet" width="56" height="56" style="display: block; border-radius: 12px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 0 48px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 38px; font-weight: 700; color: #111827; line-height: 1.2; letter-spacing: -0.02em;">
                Security Alert
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <div style="background: \${alertBg}; border-left: 4px solid \${alertBorder}; padding: 20px; margin-bottom: 32px; border-radius: 8px;">
                <h2 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: \${alertColor}; letter-spacing: -0.01em;">
                  \${title}
                </h2>
                <p style="margin: 0 0 16px; font-size: 17px; line-height: 1.7; color: #374151;">
                  \${message}
                </p>
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #6b7280;">
                  \${action}
                </p>
              </div>
            </td>
          </tr>

          <!-- Device Details -->
          <tr>
            <td style="padding: 0 48px 48px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.01em;">Device Details</h2>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="140" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">Device:</td>
                          <td style="color: #111827; font-size: 16px;">\${deviceInfo.deviceName}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="140" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">Location:</td>
                          <td style="color: #111827; font-size: 16px;">\${deviceInfo.location.city}, \${deviceInfo.location.country}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="140" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">IP Address:</td>
                          <td style="color: #111827; font-size: 16px;">\${deviceInfo.ipAddress}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="140" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">Risk Score:</td>
                          <td style="color: #111827; font-size: 16px;">\${deviceInfo.riskScore}/100</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="140" style="font-weight: 600; color: #6b7280; font-size: 16px; padding-right: 12px;">Time:</td>
                          <td style="color: #111827; font-size: 16px;">\${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #92400e;">⚠️ Security Recommendations</p>
                <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 16px; line-height: 1.8;">
                  <li>Review your trusted devices in account settings</li>
                  <li>Enable two-factor authentication if not already enabled</li>
                  <li>Change your password if you suspect unauthorized access</li>
                  <li>Contact support immediately if this activity is suspicious</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="background: #fafafa; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 17px; line-height: 1.7; color: #374151;">
                Questions? Our support team is available 24/7
              </p>
              <a href="mailto:support@blazewallet.io" style="font-size: 17px; font-weight: 600; color: #f97316; text-decoration: none;">
                support@blazewallet.io
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #111827; padding: 32px 48px; text-align: center;">
              <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 600; color: white; margin-bottom: 6px; letter-spacing: 0.5px;">
                  BLAZE WALLET
                </div>
                <div style="font-size: 13px; color: #9ca3af;">
                  The future of multi-chain crypto management
                </div>
              </div>
              
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/wallet" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Wallet</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/about" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">About</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/security" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Security</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/support" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Support</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/privacy" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Privacy policy</a></td>
                </tr>
              </table>
              
              <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
                © \${new Date().getFullYear()} BLAZE Wallet. All rights reserved.<br />
                This email was sent because you created an account at my.blazewallet.io
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  \`;
}`
    },
    {
      id: 'priority-list-user',
      name: 'Priority List User Confirmation',
      description: 'Sent to users who register for priority list with email. Fully implemented with uniform styling.',
      subject: '🔥 Welcome to BLAZE Priority List - Confirm Your Email!',
      location: 'lib/email-service.ts',
      function: 'generateUserConfirmationEmail',
      apiRoutes: ['Used by lib/priority-list-service.ts'],
      code: `// File: lib/email-service.ts
export function generateUserConfirmationEmail(params: any): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const logoUrl = \`\${ASSET_BASE_URL}/icons/icon-512x512.png\`;

  return \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BLAZE Priority List - BLAZE Wallet</title>
  <!--[if mso]>
    <style type="text/css">
      body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      img {border: 0 !important; outline: none !important; text-decoration: none !important;}
    </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background: white; box-shadow: 0 2px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 48px 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 24px; border-bottom: 2px solid #f97316;">
                    <img src="\${logoUrl}" alt="BLAZE Wallet" width="56" height="56" style="display: block; border-radius: 12px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 0 48px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 38px; font-weight: 700; color: #111827; line-height: 1.2; letter-spacing: -0.02em;">
                Welcome to BLAZE Priority List
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <p style="margin: 0 0 20px; font-size: 19px; line-height: 1.7; color: #374151;">
                Thank you for registering for the BLAZE Priority List! We're excited to have you on board.
              </p>
              
              <p style="margin: 0; font-size: 19px; line-height: 1.7; color: #374151;">
                Your wallet address: <strong style="color: #111827;">\${params.walletAddress || 'N/A'}</strong>
              </p>
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="background: #fafafa; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 17px; line-height: 1.7; color: #374151;">
                Questions? Our support team is available 24/7
              </p>
              <a href="mailto:support@blazewallet.io" style="font-size: 17px; font-weight: 600; color: #f97316; text-decoration: none;">
                support@blazewallet.io
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #111827; padding: 32px 48px; text-align: center;">
              <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 600; color: white; margin-bottom: 6px; letter-spacing: 0.5px;">
                  BLAZE WALLET
                </div>
                <div style="font-size: 13px; color: #9ca3af;">
                  The future of multi-chain crypto management
                </div>
              </div>
              
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/wallet" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Wallet</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/about" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">About</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/security" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Security</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/support" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Support</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/privacy" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Privacy policy</a></td>
                </tr>
              </table>
              
              <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
                © \${new Date().getFullYear()} BLAZE Wallet. All rights reserved.<br />
                This email was sent because you created an account at my.blazewallet.io
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  \`;
}`
    },
    {
      id: 'priority-list-admin',
      name: 'Priority List Admin Notification',
      description: 'Sent to admin (info@blazewallet.io) when someone registers for priority list. Fully implemented with uniform styling.',
      subject: '🔥 New Priority List Registration #X - [wallet]',
      location: 'lib/email-service.ts',
      function: 'generateAdminNotificationEmail',
      apiRoutes: ['Used by lib/priority-list-service.ts'],
      code: `// File: lib/email-service.ts
export function generateAdminNotificationEmail(params: any): string {
  const ASSET_BASE_URL = 'https://my.blazewallet.io';
  const logoUrl = \`\${ASSET_BASE_URL}/icons/icon-512x512.png\`;

  return \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Priority List Registration - BLAZE Wallet</title>
  <!--[if mso]>
    <style type="text/css">
      body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      img {border: 0 !important; outline: none !important; text-decoration: none !important;}
    </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background: white; box-shadow: 0 2px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 48px 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom: 24px; border-bottom: 2px solid #f97316;">
                    <img src="\${logoUrl}" alt="BLAZE Wallet" width="56" height="56" style="display: block; border-radius: 12px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 0 48px 40px;">
              <h1 style="margin: 0 0 24px; font-size: 38px; font-weight: 700; color: #111827; line-height: 1.2; letter-spacing: -0.02em;">
                New Priority List Registration
              </h1>
              
              <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #f97316 0%, #fb923c 100%); border-radius: 2px; margin-bottom: 32px;"></div>
              
              <p style="margin: 0 0 20px; font-size: 19px; line-height: 1.7; color: #374151;">
                A new user has registered for the BLAZE Priority List.
              </p>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <p style="margin: 0; font-size: 17px; line-height: 1.7; color: #374151;">
                  <strong style="color: #111827;">Wallet Address:</strong> \${params.walletAddress || 'N/A'}
                </p>
              </div>
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="background: #fafafa; padding: 40px 48px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 17px; line-height: 1.7; color: #374151;">
                Questions? Our support team is available 24/7
              </p>
              <a href="mailto:support@blazewallet.io" style="font-size: 17px; font-weight: 600; color: #f97316; text-decoration: none;">
                support@blazewallet.io
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #111827; padding: 32px 48px; text-align: center;">
              <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 600; color: white; margin-bottom: 6px; letter-spacing: 0.5px;">
                  BLAZE WALLET
                </div>
                <div style="font-size: 13px; color: #9ca3af;">
                  The future of multi-chain crypto management
                </div>
              </div>
              
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px;">
                <tr>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/wallet" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Wallet</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/about" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">About</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/security" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Security</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/support" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Support</a></td>
                  <td style="padding: 0 10px;"><a href="https://my.blazewallet.io/privacy" style="color: #9ca3af; text-decoration: none; font-size: 13px; font-weight: 500;">Privacy policy</a></td>
                </tr>
              </table>
              
              <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
                © \${new Date().getFullYear()} BLAZE Wallet. All rights reserved.<br />
                This email was sent because you created an account at my.blazewallet.io
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  \`;
}`
    }
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Email Templates Overview</h3>
            <p className="text-sm text-gray-500">All emails sent from BLAZE Wallet with exact code</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          This page shows all email templates used in BLAZE Wallet. Each template includes the exact code, location, and API routes that trigger it.
        </p>
      </div>

      <div className="space-y-4">
        {emails.map((email) => (
          <div key={email.id} className="bg-white rounded-2xl shadow-soft border border-gray-200 overflow-hidden">
            <div 
              className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setSelectedEmail(selectedEmail === email.id ? null : email.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-bold text-gray-900">{email.name}</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{email.description}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <div>
                      <span className="font-medium">Subject:</span> {email.subject}
                    </div>
                    <div>
                      <span className="font-medium">Location:</span> {email.location}
                    </div>
                    <div>
                      <span className="font-medium">Function:</span> {email.function}
                    </div>
                    <div>
                      <span className="font-medium">API Routes:</span> {email.apiRoutes.join(', ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewEmail(email.id);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Preview email"
                  >
                    <Eye className="w-5 h-5 text-primary-600" />
                  </button>
                  <ChevronRight 
                    className={`w-5 h-5 text-gray-400 transition-transform ${selectedEmail === email.id ? 'rotate-90' : ''}`}
                  />
                </div>
              </div>
            </div>
            
            {selectedEmail === email.id && (
              <div className="border-t border-gray-200 bg-gray-50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="font-semibold text-gray-900">Email Template Code</h5>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(email.code, email.id);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm"
                  >
                    {copied === email.id ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        Copy Code
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  <code>{email.code}</code>
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Email Management</h4>
            <p className="text-sm text-blue-800 mb-3">
              To edit email templates, modify the source files directly. Changes will be reflected immediately after deployment.
            </p>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>Welcome/Verification: <code className="bg-blue-100 px-1 rounded">lib/email-template.ts</code></li>
              <li>Device Verification Code: <code className="bg-blue-100 px-1 rounded">app/api/device-verification-code/route.ts</code></li>
              <li>Device Verification Link: <code className="bg-blue-100 px-1 rounded">app/api/verify-device/route.ts</code></li>
              <li>Device Verification (Service): <code className="bg-blue-100 px-1 rounded">lib/email-service.ts</code></li>
              <li>Security Alert: <code className="bg-blue-100 px-1 rounded">app/api/security-alert/route.ts</code> (needs implementation)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      {previewEmail && (
        <EmailPreviewModal
          email={emails.find(e => e.id === previewEmail)!}
          onClose={() => setPreviewEmail(null)}
        />
      )}
    </div>
  );
}

// Email Preview Modal Component
function EmailPreviewModal({ email, onClose }: { email: any; onClose: () => void }) {
  // Extract HTML from the code string
  const extractHTML = (code: string): string => {
    // Try to find the HTML content between the return statement and the closing backtick
    const htmlMatch = code.match(/return\s+`([\s\S]*?)`/);
    if (htmlMatch && htmlMatch[1]) {
      return htmlMatch[1].trim();
    }
    
    // Fallback: try to find HTML between backticks
    const backtickMatch = code.match(/`([\s\S]*?)`/);
    if (backtickMatch && backtickMatch[1]) {
      return backtickMatch[1].trim();
    }
    
    // If no match, return the full code (might be plain HTML)
    return code;
  };

  const htmlContent = extractHTML(email.code);
  
  // Replace template variables with sample data for preview
  const previewHTML = htmlContent
    .replace(/\$\{verificationLink\}/g, '#')
    .replace(/\$\{logoUrl\}/g, 'https://my.blazewallet.io/icons/icon-512x512.png')
    .replace(/\$\{ASSET_BASE_URL\}/g, 'https://my.blazewallet.io')
    .replace(/\$\{code\}/g, '123456')
    .replace(/\$\{deviceName\}/g, 'iPhone 15 Pro')
    .replace(/\$\{location\}/g, 'Amsterdam, Netherlands')
    .replace(/\$\{deviceInfo\.deviceName\}/g, 'iPhone 15 Pro')
    .replace(/\$\{deviceInfo\.browser\}/g, 'Safari 17.0')
    .replace(/\$\{deviceInfo\.os\}/g, 'iOS 17.1')
    .replace(/\$\{deviceInfo\.location\.city\}/g, 'Amsterdam')
    .replace(/\$\{deviceInfo\.location\.country\}/g, 'Netherlands')
    .replace(/\$\{deviceInfo\.location\}/g, 'Amsterdam, Netherlands')
    .replace(/\$\{deviceInfo\.ipAddress\}/g, '192.168.1.1')
    .replace(/\$\{deviceInfo\.riskScore\}/g, '75')
    .replace(/\$\{deviceInfo\.isTor\}/g, 'false')
    .replace(/\$\{deviceInfo\.isVPN\}/g, 'false')
    .replace(/\$\{params\.walletAddress\}/g, '0x742d35Cc6634C0532925a3b844Bc9e5C3D3E8D3F5')
    .replace(/\$\{alertType\}/g, 'suspicious_login_blocked')
    .replace(/\$\{new Date\(\)\.getFullYear\(\)\}/g, new Date().getFullYear().toString())
    .replace(/\$\{new Date\(\)\.toLocaleString\([^)]+\)\}/g, new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }))
    .replace(/\$\{CACHE_BUST\}/g, Date.now().toString());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{email.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{email.subject}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
            <iframe
              srcDoc={previewHTML}
              className="w-full h-[600px] border-0 rounded-lg"
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-500 text-center">
            This is a preview with sample data. Actual emails may vary.
          </p>
        </div>
      </div>
    </div>
  );
}
