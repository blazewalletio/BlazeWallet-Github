'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  BarChart3, Users, TrendingUp, AlertTriangle, 
  CheckCircle2, XCircle, Clock, RefreshCw,
  DollarSign, Activity, Zap, Shield
} from 'lucide-react';
import { logger } from '@/lib/logger';

// Whitelisted admin emails
const ALLOWED_ADMINS = [
  'ricks_@live.nl',
];

interface Metrics {
  activeUsers24h: number;
  transactions24h: number;
  volume24h: number;
  failedRate: number;
}

interface Cohorts {
  new: number;
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
  alerts: {
    unreadCount: number;
    critical: Alert[];
  };
  recentActivity: any[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Check authentication and authorization
  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!authorized) return;

    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [authorized]);

  async function checkAuth() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user || !user.email) {
        logger.warn('[Admin] Not authenticated');
        router.push('/');
        return;
      }

      if (!ALLOWED_ADMINS.includes(user.email)) {
        logger.warn(`[Admin] Unauthorized access attempt: ${user.email}`);
        router.push('/');
        return;
      }

      setUserEmail(user.email);
      setAuthorized(true);
      fetchDashboardData();
    } catch (error) {
      logger.error('[Admin] Auth check failed:', error);
      router.push('/');
    }
  }

  async function fetchDashboardData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setRefreshing(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      const response = await fetch('/api/admin/analytics/overview', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const result = await response.json();
      setData(result.data);
      setLastRefresh(new Date());
    } catch (error) {
      logger.error('[Admin] Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading || !authorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">BLAZE Analytics</h1>
              <p className="text-sm text-gray-400 mt-1">
                Logged in as: {userEmail}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right text-sm text-gray-400">
                <p>Last updated:</p>
                <p className="font-mono">{lastRefresh.toLocaleTimeString()}</p>
              </div>
              
              <button
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                className={`p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors ${
                  refreshing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Critical Alerts */}
        {data && data.alerts.critical.length > 0 && (
          <div className="mb-8 bg-red-500/20 border border-red-500 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-red-500 mb-3">🚨 Critical Alerts</h2>
                {data.alerts.critical.map(alert => (
                  <div key={alert.id} className="bg-black/30 rounded p-4 mb-2">
                    <p className="font-semibold">{alert.title}</p>
                    <p className="text-sm text-gray-300 mt-1">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KPI Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Active Users (24h)"
            value={data?.metrics.activeUsers24h || 0}
            icon={<Users className="w-6 h-6" />}
            color="blue"
            trend={data?.trends.transactions}
          />
          <MetricCard
            title="Transactions (24h)"
            value={data?.metrics.transactions24h || 0}
            icon={<Activity className="w-6 h-6" />}
            color="green"
            trend={data?.trends.transactions}
          />
          <MetricCard
            title="Volume (24h)"
            value={`$${(data?.metrics.volume24h || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            icon={<DollarSign className="w-6 h-6" />}
            color="purple"
          />
          <MetricCard
            title="Failed Rate"
            value={`${(data?.metrics.failedRate || 0).toFixed(1)}%`}
            icon={<XCircle className="w-6 h-6" />}
            color={data && data.metrics.failedRate > 5 ? 'red' : 'yellow'}
          />
        </div>

        {/* User Cohorts */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 mb-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Users className="w-6 h-6" />
            User Segments
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <CohortCard
              title="New Users"
              count={data?.cohorts.new || 0}
              total={data?.totalUsers || 1}
              color="blue"
            />
            <CohortCard
              title="Active"
              count={data?.cohorts.active || 0}
              total={data?.totalUsers || 1}
              color="green"
            />
            <CohortCard
              title="Power Users"
              count={data?.cohorts.power_user || 0}
              total={data?.totalUsers || 1}
              color="purple"
            />
            <CohortCard
              title="Dormant"
              count={data?.cohorts.dormant || 0}
              total={data?.totalUsers || 1}
              color="yellow"
            />
            <CohortCard
              title="Churned"
              count={data?.cohorts.churned || 0}
              total={data?.totalUsers || 1}
              color="red"
            />
          </div>
        </div>

        {/* Alerts Summary */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Alerts
            </h2>
            {data && data.alerts.unreadCount > 0 && (
              <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                {data.alerts.unreadCount} unread
              </span>
            )}
          </div>
          
          {data && data.alerts.unreadCount === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No unread alerts - All good! 🎉</p>
            </div>
          ) : (
            <p className="text-gray-300">
              You have {data?.alerts.unreadCount} unread alerts. Check them regularly for important updates.
            </p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6" />
            Recent Activity (Last 24h)
          </h2>
          
          {data && data.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {data.recentActivity.slice(0, 10).map((event, index) => (
                <div key={index} className="bg-black/30 rounded p-4 flex items-start gap-3">
                  <div className={`p-2 rounded ${
                    event.status === 'success' ? 'bg-green-500/20' :
                    event.status === 'failed' ? 'bg-red-500/20' :
                    'bg-yellow-500/20'
                  }`}>
                    {event.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                     event.status === 'failed' ? <XCircle className="w-4 h-4 text-red-500" /> :
                     <Clock className="w-4 h-4 text-yellow-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold capitalize">
                      {event.event_type.replace(/_/g, ' ')}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                      <span>{event.chain_key.toUpperCase()}</span>
                      {event.token_symbol && <span>• {event.token_symbol}</span>}
                      {event.value_usd && <span>• ${event.value_usd.toFixed(2)}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, icon, color, trend }: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: number;
}) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
    red: 'from-red-500/20 to-red-600/20 border-red-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} backdrop-blur-sm rounded-lg p-6 border`}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-white/10 rounded-lg">
          {icon}
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`text-sm font-semibold ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </div>
        )}
      </div>
      <h3 className="text-sm text-gray-300 mb-1">{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

// Cohort Card Component
function CohortCard({ title, count, total, color }: {
  title: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div className="bg-black/30 rounded-lg p-4">
      <h4 className="text-sm text-gray-400 mb-2">{title}</h4>
      <p className="text-2xl font-bold mb-3">{count}</p>
      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full ${colorClasses[color as keyof typeof colorClasses]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">{percentage.toFixed(1)}% of users</p>
    </div>
  );
}
