import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Admin client with service role (bypasses RLS)
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

/**
 * GET /api/cron/aggregate-analytics
 * 
 * Cron job for analytics aggregations and anomaly detection
 * Called by EasyCron every hour
 * 
 * Tasks:
 * 1. Update user cohorts (segment users based on activity)
 * 2. Calculate engagement scores
 * 3. Update realtime metrics
 * 4. Check for anomalies and create alerts
 * 5. Cleanup expired data
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret (EasyCron authentication)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      logger.error('[Analytics Cron] CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.error('[Analytics Cron] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.log('📊 [Analytics Cron] Starting analytics aggregation...');

    // Task 1: Update user cohorts and segments
    await updateUserCohorts();

    // Task 2: Calculate engagement scores
    await calculateEngagementScores();

    // Task 3: Update realtime metrics
    await updateRealtimeMetrics();

    // Task 4: Check for anomalies
    await checkForAnomalies();

    // Task 5: Cleanup expired data
    await cleanupExpiredData();

    const duration = Date.now() - startTime;
    logger.log(`✅ [Analytics Cron] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    logger.error('[Analytics Cron] Failed:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Task 1: Update user cohorts and segments
 */
async function updateUserCohorts() {
  logger.log('[Analytics Cron] Task 1: Updating user cohorts...');

  // Get all users with activity in last 90 days
  const { data: events, error } = await supabaseAdmin
    .from('transaction_events')
    .select('user_id, created_at')
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    logger.error('[Analytics Cron] Failed to fetch active users:', error);
    return;
  }

  // Manually group events by user_id
  const userActivity: Record<string, { eventCount: number; lastEvent: Date }> = {};
  events?.forEach((event) => {
    const userId = event.user_id;
    const eventDate = new Date(event.created_at);

    if (!userActivity[userId]) {
      userActivity[userId] = { eventCount: 0, lastEvent: eventDate };
    }

    userActivity[userId].eventCount++;
    if (eventDate > userActivity[userId].lastEvent) {
      userActivity[userId].lastEvent = eventDate;
    }
  });

  // Update segments for each user
  let updateCount = 0;
  for (const [userId, activity] of Object.entries(userActivity)) {
    const daysSinceLastEvent = Math.floor(
      (Date.now() - activity.lastEvent.getTime()) / (24 * 60 * 60 * 1000)
    );

    let segment: string;
    if (daysSinceLastEvent <= 7) {
      segment = activity.eventCount > 20 ? 'power_user' : 'active';
    } else if (daysSinceLastEvent <= 30) {
      segment = 'dormant';
    } else {
      segment = 'churned';
    }

    await supabaseAdmin
      .from('user_cohorts')
      .update({
        user_segment: segment,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    
    updateCount++;
  }

  logger.log(`[Analytics Cron] Updated cohorts for ${updateCount} users`);
}

/**
 * Task 2: Calculate engagement scores (0-100)
 */
async function calculateEngagementScores() {
  logger.log('[Analytics Cron] Task 2: Calculating engagement scores...');

  const { data: cohorts } = await supabaseAdmin
    .from('user_cohorts')
    .select('*');

  for (const cohort of cohorts || []) {
    // Calculate score based on:
    // - Recency (40 points): Last transaction date
    // - Frequency (30 points): Total transactions
    // - Volume (30 points): Total volume USD

    const now = Date.now();
    const lastTx = cohort.last_transaction_date 
      ? new Date(cohort.last_transaction_date).getTime()
      : now - 90 * 24 * 60 * 60 * 1000;

    const daysSinceLastTx = Math.floor((now - lastTx) / (24 * 60 * 60 * 1000));

    // Recency score (40 points max)
    let recencyScore = 0;
    if (daysSinceLastTx === 0) recencyScore = 40;
    else if (daysSinceLastTx <= 7) recencyScore = 35;
    else if (daysSinceLastTx <= 30) recencyScore = 25;
    else if (daysSinceLastTx <= 90) recencyScore = 10;

    // Frequency score (30 points max)
    const txCount = cohort.total_transactions || 0;
    let frequencyScore = Math.min(30, Math.floor(txCount / 2));

    // Volume score (30 points max)
    const volume = parseFloat(cohort.total_volume_usd || '0');
    let volumeScore = 0;
    if (volume > 50000) volumeScore = 30;
    else if (volume > 10000) volumeScore = 25;
    else if (volume > 5000) volumeScore = 20;
    else if (volume > 1000) volumeScore = 15;
    else if (volume > 100) volumeScore = 10;

    const engagementScore = Math.min(100, recencyScore + frequencyScore + volumeScore);

    await supabaseAdmin
      .from('user_cohorts')
      .update({
        engagement_score: engagementScore,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', cohort.user_id);
  }

  logger.log(`[Analytics Cron] Calculated scores for ${cohorts?.length || 0} users`);
}

/**
 * Task 3: Update realtime metrics for dashboard
 */
async function updateRealtimeMetrics() {
  logger.log('[Analytics Cron] Task 3: Updating realtime metrics...');

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Metric 1: Active users (last 24h)
  const { count: activeUsers } = await supabaseAdmin
    .from('transaction_events')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', last24h.toISOString());

  await insertRealtimeMetric('active_users_24h', activeUsers || 0);

  // Metric 2: Total transactions (last 24h)
  const { count: totalTxs } = await supabaseAdmin
    .from('transaction_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'success')
    .gte('created_at', last24h.toISOString());

  await insertRealtimeMetric('transactions_24h', totalTxs || 0);

  // Metric 3: Total volume (last 24h)
  const { data: volumeData } = await supabaseAdmin
    .from('transaction_events')
    .select('value_usd')
    .eq('status', 'success')
    .gte('created_at', last24h.toISOString());

  const totalVolume = volumeData?.reduce((sum, tx) => sum + (parseFloat(tx.value_usd) || 0), 0) || 0;
  await insertRealtimeMetric('volume_24h', totalVolume);

  // Metric 4: Failed transaction rate
  const { count: failedTxs } = await supabaseAdmin
    .from('transaction_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', last24h.toISOString());

  const failedRate = totalTxs ? ((failedTxs || 0) / totalTxs) * 100 : 0;
  await insertRealtimeMetric('failed_rate', failedRate);

  logger.log('[Analytics Cron] Updated 4 realtime metrics');
}

/**
 * Helper: Insert realtime metric
 */
async function insertRealtimeMetric(key: string, value: number) {
  await supabaseAdmin
    .from('realtime_metrics')
    .insert({
      metric_key: key,
      metric_value: value,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
}

/**
 * Task 4: Check for anomalies and create alerts
 */
async function checkForAnomalies() {
  logger.log('[Analytics Cron] Task 4: Checking for anomalies...');

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const lastHour = new Date(Date.now() - 60 * 60 * 1000);

  // Anomaly 1: High volume user (>$10k in 24h)
  const { data: highVolumeUsers } = await supabaseAdmin.rpc(
    'get_high_volume_users',
    { threshold_usd: 10000, hours: 24 }
  ).catch(() => ({ data: null }));

  // If RPC doesn't exist, use manual query
  if (!highVolumeUsers) {
    const { data: events } = await supabaseAdmin
      .from('transaction_events')
      .select('user_id, value_usd')
      .gte('created_at', last24h.toISOString())
      .eq('status', 'success');

    const volumeByUser: Record<string, number> = {};
    events?.forEach(e => {
      volumeByUser[e.user_id] = (volumeByUser[e.user_id] || 0) + (parseFloat(e.value_usd) || 0);
    });

    for (const [userId, volume] of Object.entries(volumeByUser)) {
      if (volume > 10000) {
        await createAlert({
          alertType: 'high_volume_user',
          severity: 'warning',
          title: 'High Volume User Detected',
          message: `User has transacted $${volume.toFixed(2)} in the last 24 hours.`,
          userId,
        });
      }
    }
  }

  // Anomaly 2: Failed transactions spike (>50 in last hour)
  const { count: failedCount } = await supabaseAdmin
    .from('transaction_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', lastHour.toISOString());

  if ((failedCount || 0) > 50) {
    await createAlert({
      alertType: 'failed_transactions_spike',
      severity: 'critical',
      title: '🚨 Failed Transactions Spike',
      message: `${failedCount} failed transactions in the last hour. Investigate immediately!`,
    });
  }

  // Anomaly 3: New user spike (>100 new signups today)
  const today = new Date().toISOString().split('T')[0];
  const { count: newUsersToday } = await supabaseAdmin
    .from('user_cohorts')
    .select('*', { count: 'exact', head: true })
    .eq('signup_date', today);

  if ((newUsersToday || 0) > 100) {
    await createAlert({
      alertType: 'new_user_spike',
      severity: 'info',
      title: '🎉 New User Spike!',
      message: `${newUsersToday} new users signed up today! Growth is accelerating.`,
    });
  }

  logger.log('[Analytics Cron] Anomaly check completed');
}

/**
 * Helper: Create alert
 */
async function createAlert(alert: {
  alertType: string;
  severity: string;
  title: string;
  message: string;
  userId?: string;
  metadata?: any;
}) {
  // Check if similar alert already exists (prevent spam)
  const { data: existing } = await supabaseAdmin
    .from('admin_alerts')
    .select('id')
    .eq('alert_type', alert.alertType)
    .eq('status', 'unread')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  if (existing && existing.length > 0) {
    logger.log(`[Analytics Cron] Alert already exists: ${alert.alertType}`);
    return;
  }

  await supabaseAdmin
    .from('admin_alerts')
    .insert({
      alert_type: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      user_id: alert.userId || null,
      metadata: alert.metadata || {},
    });

  logger.log(`[Analytics Cron] Created alert: ${alert.title}`);
}

/**
 * Task 5: Cleanup expired data
 */
async function cleanupExpiredData() {
  logger.log('[Analytics Cron] Task 5: Cleaning up expired data...');

  // Cleanup expired realtime metrics
  const { error } = await supabaseAdmin.rpc('cleanup_expired_realtime_metrics');

  if (error) {
    logger.error('[Analytics Cron] Cleanup failed:', error);
  } else {
    logger.log('[Analytics Cron] Expired data cleaned');
  }
}

