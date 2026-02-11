-- Fix trusted_devices uniqueness model:
-- device_id must be unique per user (not globally), so one physical device can be
-- used across multiple wallet accounts on the same browser/app installation.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_device_id'
      AND conrelid = 'trusted_devices'::regclass
  ) THEN
    ALTER TABLE trusted_devices DROP CONSTRAINT unique_device_id;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_trusted_devices_user_device_id'
      AND conrelid = 'trusted_devices'::regclass
  ) THEN
    ALTER TABLE trusted_devices
      ADD CONSTRAINT unique_trusted_devices_user_device_id UNIQUE (user_id, device_id);
  END IF;
END $$;


