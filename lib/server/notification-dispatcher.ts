import webpush from 'web-push';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type AppNotificationType =
  | 'transaction_executed'
  | 'transaction_scheduled'
  | 'transaction_cancelled'
  | 'transaction_failed'
  | 'gas_alert'
  | 'savings_milestone'
  | 'recurring_executed'
  | 'security_alert'
  | 'price_alert'
  | 'system';

interface NotificationPreferences {
  notifications_enabled: boolean;
  in_app_enabled: boolean;
  push_enabled: boolean;
  transactions_enabled: boolean;
  security_enabled: boolean;
  price_alerts_enabled: boolean;
  news_enabled: boolean;
  promotions_enabled: boolean;
}

interface DispatchInput {
  userId: string;
  supabaseUserId?: string | null;
  type: AppNotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

let pushConfigInitialized = false;
let pushConfigured = false;

function getDefaultPreferences(): NotificationPreferences {
  return {
    notifications_enabled: true,
    in_app_enabled: true,
    push_enabled: false,
    transactions_enabled: true,
    security_enabled: true,
    price_alerts_enabled: false,
    news_enabled: false,
    promotions_enabled: false,
  };
}

function isTypeEnabledByPreferences(type: AppNotificationType, prefs: NotificationPreferences): boolean {
  if (!prefs.notifications_enabled) return false;

  switch (type) {
    case 'transaction_executed':
    case 'transaction_scheduled':
    case 'transaction_failed':
    case 'transaction_cancelled':
    case 'gas_alert':
    case 'savings_milestone':
    case 'recurring_executed':
      return prefs.transactions_enabled;
    case 'security_alert':
      return prefs.security_enabled;
    case 'price_alert':
      return prefs.price_alerts_enabled;
    case 'system':
      return true;
    default:
      return true;
  }
}

function configureWebPush(): boolean {
  if (pushConfigInitialized) return pushConfigured;
  pushConfigInitialized = true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:support@blazewallet.io';

  if (!publicKey || !privateKey) {
    logger.warn('[NotificationDispatcher] VAPID keys missing. Push delivery disabled.');
    pushConfigured = false;
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    pushConfigured = true;
    logger.log('[NotificationDispatcher] Web Push configured.');
  } catch (err) {
    logger.error('[NotificationDispatcher] Failed to configure Web Push:', err);
    pushConfigured = false;
  }

  return pushConfigured;
}

async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const { data } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return getDefaultPreferences();
    return {
      ...getDefaultPreferences(),
      ...data,
    };
  } catch (err) {
    logger.warn('[NotificationDispatcher] Failed to load preferences, using defaults:', err);
    return getDefaultPreferences();
  }
}

async function sendPushToUser(userId: string, payload: Record<string, any>): Promise<void> {
  if (!configureWebPush()) return;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: subscriptions, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('enabled', true)
    .is('revoked_at', null);

  if (error) {
    logger.error('[NotificationDispatcher] Failed to fetch subscriptions:', error);
    return;
  }

  for (const sub of subscriptions || []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload),
        { TTL: 60 }
      );
    } catch (err: any) {
      const statusCode = err?.statusCode || err?.status || 0;
      logger.warn('[NotificationDispatcher] Push delivery failed:', {
        subscriptionId: sub.id,
        statusCode,
      });

      // Subscription is gone/invalid - revoke it server-side.
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ enabled: false, revoked_at: new Date().toISOString() })
          .eq('id', sub.id);
      }
    }
  }
}

export async function dispatchNotification(input: DispatchInput): Promise<void> {
  const prefs = await getPreferences(input.supabaseUserId || input.userId);
  const typeEnabled = isTypeEnabledByPreferences(input.type, prefs);
  if (!typeEnabled) return;

  const supabaseAdmin = getSupabaseAdmin();
  const shouldStoreInApp = prefs.in_app_enabled;

  if (shouldStoreInApp) {
    await supabaseAdmin.from('notifications').insert({
      user_id: input.userId,
      supabase_user_id: input.supabaseUserId || null,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data || null,
      read: false,
    });
  }

  if (prefs.push_enabled && input.supabaseUserId) {
    await sendPushToUser(input.supabaseUserId, {
      title: input.title,
      body: input.message,
      type: input.type,
      data: input.data || {},
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: input.type,
      url: '/?open=notifications',
    });
  }
}


