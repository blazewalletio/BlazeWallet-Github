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

interface UserListData {
  users: any[];
  total: number;
  limit: number;
  offset: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [transactionData, setTransactionData] = useState<TransactionData | null>(null);
  const [onrampData, setOnrampData] = useState<OnrampData | null>(null);
  const [userList, setUserList] = useState<UserListData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'users' | 'onramp'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

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
    if (activeTab === 'users') {
      fetchUserList();
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

  async function fetchDashboardData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setRefreshing(true);

      const sessionToken = localStorage.getItem('admin_session');
      if (!sessionToken) {
        router.push('/login');
        return;
      }

      const overviewResponse = await fetch('/api/admin/analytics/overview', {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (!overviewResponse.ok) throw new Error('Failed to fetch overview data');
      const overviewResult = await overviewResponse.json();
      setData(overviewResult.data);

      const transactionsResponse = await fetch('/api/admin/analytics/transactions', {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      if (transactionsResponse.ok) {
        const transactionsResult = await transactionsResponse.json();
        setTransactionData(transactionsResult.data);
      }

      const onrampResponse = await fetch('/api/admin/analytics/onramp', {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      if (onrampResponse.ok) {
        const onrampResult = await onrampResponse.json();
        setOnrampData(onrampResult.data);
      }

      setLastRefresh(new Date());
    } catch (error) {
      logger.error('[Admin] Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchUserList() {
    try {
      const sessionToken = localStorage.getItem('admin_session');
      if (!sessionToken) return;

      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        const result = await response.json();
        setUserList(result.data);
      }
    } catch (error) {
      logger.error('[Admin] Failed to fetch users:', error);
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

  const filteredUsers = userList?.users.filter(user => 
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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
                  <p className="text-sm text-gray-500">Analytics & User Management</p>
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
                <h2 className="text-xl font-bold text-red-700 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Critical Alerts
                </h2>
                <div className="space-y-3">
                  {data.alerts?.critical.map(alert => (
                    <div key={alert.id} className="bg-white rounded-xl p-4 border border-red-200">
                      <p className="font-semibold text-gray-900">{alert.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OVERVIEW TAB - Continued in next message due to length */}

