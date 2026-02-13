-- ============================================================================
-- Notifications + Push foundation
-- - Canonical notification log table
-- - Per-user notification preferences
-- - Web/PWA push subscriptions
-- ============================================================================

-- 1) Notifications table (in-app event log)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'transaction_executed',
      'transaction_scheduled',
      'transaction_cancelled',
      'transaction_failed',
      'gas_alert',
      'savings_milestone',
      'recurring_executed',
      'security_alert',
      'price_alert',
      'system'
    )
  );

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_supabase_user_created
  ON public.notifications(supabase_user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT
  USING (supabase_user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE
  USING (supabase_user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE
  USING (supabase_user_id = auth.uid());

-- 2) Notification preferences (source of truth for channel + type toggles)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  transactions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  security_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  price_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  news_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  promotions_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_updated_at
  ON public.notification_preferences(updated_at DESC);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_preferences_select_own ON public.notification_preferences;
CREATE POLICY notification_preferences_select_own ON public.notification_preferences
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_insert_own ON public.notification_preferences;
CREATE POLICY notification_preferences_insert_own ON public.notification_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_update_own ON public.notification_preferences;
CREATE POLICY notification_preferences_update_own ON public.notification_preferences
  FOR UPDATE
  USING (user_id = auth.uid());

-- 3) Push subscriptions (Web Push endpoints per user/device)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_id TEXT,
  platform TEXT NOT NULL DEFAULT 'web',
  user_agent TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT push_subscriptions_platform_check CHECK (platform IN ('web', 'pwa', 'ios', 'android'))
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_enabled
  ON public.push_subscriptions(user_id, enabled, revoked_at);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_seen
  ON public.push_subscriptions(last_seen_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE
  USING (user_id = auth.uid());


