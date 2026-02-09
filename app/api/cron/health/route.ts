/**
 * 🔥 BLAZE WALLET - CRON HEALTH CHECK ENDPOINT
 * 
 * Used by EasyCron for monitoring and health checks
 * Returns status of pending transactions and system health
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  try {
    // Get pending transactions count
    const { count: pendingCount, error: countError } = await getSupabaseAdmin()
      .from('scheduled_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .gt('expires_at', new Date().toISOString());

    // Get recent executions (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentExecutions, error: execError } = await getSupabaseAdmin()
      .from('scheduled_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('executed_at', oneHourAgo);

    // Get failed transactions (last hour)
    const { count: recentFailures, error: failError } = await getSupabaseAdmin()
      .from('scheduled_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('updated_at', oneHourAgo);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: !countError && !execError && !failError,
        pending_transactions: pendingCount || 0,
        recent_executions: recentExecutions || 0,
        recent_failures: recentFailures || 0,
      },
      system: {
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
        service_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing',
      }
    };

    // Determine overall health status
    if (countError || execError || failError) {
      health.status = 'degraded';
      logger.warn('⚠️ Health check: Database connection issues');
    } else if ((recentFailures || 0) > 10) {
      health.status = 'warning';
      logger.warn('⚠️ Health check: High failure rate detected');
    }

    return NextResponse.json(health, {
      status: health.status === 'healthy' ? 200 : 200, // Always 200, status in body
    });

  } catch (error: any) {
    logger.error('❌ Health check error:', error);
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
    }, { status: 500 });
  }
}

