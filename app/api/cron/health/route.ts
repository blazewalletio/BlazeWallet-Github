/**
 * 🔥 BLAZE WALLET - CRON HEALTH CHECK ENDPOINT
 * 
 * Used by EasyCron for monitoring and health checks
 * Returns status of pending transactions and system health
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: NextRequest) {
  try {
    // Get pending transactions count
    const { count: pendingCount, error: countError } = await supabase
      .from('scheduled_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .gt('expires_at', new Date().toISOString());

    // Get recent executions (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentExecutions, error: execError } = await supabase
      .from('scheduled_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('executed_at', oneHourAgo);

    // Get failed transactions (last hour)
    const { count: recentFailures, error: failError } = await supabase
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
        supabase_url: supabaseUrl ? 'configured' : 'missing',
        service_key: supabaseServiceKey ? 'configured' : 'missing',
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

