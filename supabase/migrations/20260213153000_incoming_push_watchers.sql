-- Incoming push watchers foundation
-- Enables server-side incoming transaction detection while app is closed.

CREATE TABLE IF NOT EXISTS public.user_chain_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_key TEXT NOT NULL,
  address TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'wallet_sync',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_chain_addresses_unique UNIQUE (user_id, chain_key, address)
);

CREATE INDEX IF NOT EXISTS idx_user_chain_addresses_user_active
  ON public.user_chain_addresses(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_chain_addresses_chain_address
  ON public.user_chain_addresses(chain_key, address);

CREATE TABLE IF NOT EXISTS public.incoming_tx_watch_cursors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_key TEXT NOT NULL,
  address TEXT NOT NULL,
  last_seen_tx_hash TEXT,
  last_seen_tx_timestamp TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT incoming_tx_watch_cursors_unique UNIQUE (user_id, chain_key, address)
);

CREATE INDEX IF NOT EXISTS idx_incoming_tx_watch_cursors_lookup
  ON public.incoming_tx_watch_cursors(user_id, chain_key, address);

ALTER TABLE public.user_chain_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming_tx_watch_cursors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_chain_addresses'
      AND policyname = 'Users can read own chain addresses'
  ) THEN
    CREATE POLICY "Users can read own chain addresses"
      ON public.user_chain_addresses
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_chain_addresses'
      AND policyname = 'Users can upsert own chain addresses'
  ) THEN
    CREATE POLICY "Users can upsert own chain addresses"
      ON public.user_chain_addresses
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_chain_addresses'
      AND policyname = 'Users can update own chain addresses'
  ) THEN
    CREATE POLICY "Users can update own chain addresses"
      ON public.user_chain_addresses
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_chain_addresses'
      AND policyname = 'Service role full access chain addresses'
  ) THEN
    CREATE POLICY "Service role full access chain addresses"
      ON public.user_chain_addresses
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'incoming_tx_watch_cursors'
      AND policyname = 'Service role full access incoming cursors'
  ) THEN
    CREATE POLICY "Service role full access incoming cursors"
      ON public.incoming_tx_watch_cursors
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

