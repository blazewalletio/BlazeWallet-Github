# 🔥 BLAZE Wallet - Supabase Database Schema

> **Complete database schema documentation for BLAZE Wallet**  
> Last updated: November 21, 2025

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Tables](#tables)
3. [Functions](#functions)
4. [Triggers](#triggers)
5. [RLS Policies](#rls-policies)
6. [Storage](#storage)
7. [How to Use](#how-to-use)

---

## Overview

The BLAZE Wallet uses **8 main tables** in Supabase to store user data, profiles, activity logs, security information, and transaction notes.

### Quick Stats
- **8 Tables** (all in `public` schema)
- **5 Custom Functions** (for automation and security)
- **4 Triggers** (for auto-updating timestamps and profiles)
- **30+ RLS Policies** (for data security)
- **1 Storage Bucket** (`user-uploads` for avatars)

---

## Tables

### 1. `email_verification_tokens`
**Purpose:** Store email verification tokens for new user signups

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` |
| `token` | TEXT | Unique verification token |
| `email` | TEXT | User's email address |
| `expires_at` | TIMESTAMPTZ | Token expiration time |
| `created_at` | TIMESTAMPTZ | When token was created |
| `used_at` | TIMESTAMPTZ | When token was used (null if unused) |

**Indexes:**
- `idx_email_verification_tokens_token` on `token`
- `idx_email_verification_tokens_user_id` on `user_id`

**RLS:** Service role only

---

### 2. `user_profiles`
**Purpose:** Store user profile information and preferences

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | - | Foreign key to `auth.users` (UNIQUE) |
| `display_name` | TEXT | `'BLAZE User'` | User's display name |
| `avatar_url` | TEXT | NULL | URL to user's avatar in storage |
| `phone_number` | TEXT | NULL | User's phone number |
| `preferred_currency` | TEXT | `'USD'` | Preferred currency (USD, EUR, BTC, etc.) |
| `timezone` | TEXT | `'UTC'` | User's timezone |
| `theme` | TEXT | `'auto'` | Theme preference (light/dark/auto) |
| `balance_visible` | BOOLEAN | `true` | Whether to show balance in UI |
| `notifications_enabled` | BOOLEAN | `true` | Notification preferences |
| `two_factor_enabled` | BOOLEAN | `false` | 2FA enabled status |
| `two_factor_method` | TEXT | NULL | 2FA method ('email' or 'authenticator') |
| `two_factor_secret` | TEXT | NULL | Encrypted TOTP secret |
| `auto_lock_timeout` | INTEGER | `5` | Auto-lock timeout in minutes (0 = never) |
| `created_at` | TIMESTAMPTZ | `NOW()` | Profile creation time |
| `updated_at` | TIMESTAMPTZ | `NOW()` | Last update time |

**RLS:** Users can read/update own profile. Triggers can insert.

---

### 3. `user_activity_log`
**Purpose:** Track user activities (login, logout, transactions, settings changes)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` |
| `activity_type` | TEXT | Type: 'login', 'logout', 'transaction', 'settings_change', 'security_alert' |
| `description` | TEXT | Human-readable description |
| `ip_address` | TEXT | User's IP address |
| `device_info` | TEXT | JSON string with device details |
| `location` | TEXT | City, Country |
| `metadata` | JSONB | Additional structured data |
| `created_at` | TIMESTAMPTZ | When activity occurred |

**Indexes:**
- `idx_activity_user_id` on `user_id`
- `idx_activity_created_at` on `created_at DESC`

**RLS:** Users can read own activity. Triggers can insert.

---

### 4. `trusted_devices`
**Purpose:** Store trusted devices for device verification feature

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` |
| `device_name` | TEXT | User-friendly device name |
| `device_fingerprint` | TEXT | Unique device identifier |
| `ip_address` | TEXT | Device IP address |
| `user_agent` | TEXT | Browser user agent |
| `browser` | TEXT | Browser name |
| `os` | TEXT | Operating system |
| `is_current` | BOOLEAN | Whether this is the current device |
| `last_used_at` | TIMESTAMPTZ | Last time device was used |
| `verified_at` | TIMESTAMPTZ | When device was verified |
| `verification_token` | TEXT | Token for email verification |
| `verification_expires_at` | TIMESTAMPTZ | Token expiration time |
| `created_at` | TIMESTAMPTZ | When device was added |

**Indexes:**
- `idx_trusted_devices_user_id` on `user_id`
- `idx_trusted_devices_fingerprint` on `device_fingerprint`

**Unique constraint:** `(user_id, device_fingerprint)`

**RLS:** Users can fully manage own devices.

---

### 5. `user_security_scores`
**Purpose:** Track user security score and security features enabled

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | - | Foreign key to `auth.users` (UNIQUE) |
| `score` | INTEGER | `0` | Security score (0-100) |
| `email_verified` | BOOLEAN | `false` | Email verification status |
| `two_factor_enabled` | BOOLEAN | `false` | 2FA status |
| `strong_password` | BOOLEAN | `false` | Strong password flag |
| `seed_phrase_backed_up` | BOOLEAN | `false` | Seed phrase backup flag |
| `trusted_device_added` | BOOLEAN | `false` | Trusted device flag |
| `recovery_email_added` | BOOLEAN | `false` | Recovery email flag |
| `last_calculated_at` | TIMESTAMPTZ | `NOW()` | Last score calculation |
| `created_at` | TIMESTAMPTZ | `NOW()` | Score creation time |
| `updated_at` | TIMESTAMPTZ | `NOW()` | Last update time |

**RLS:** Users can read own score. Triggers can insert/update.

---

### 6. `user_transaction_stats`
**Purpose:** Store aggregated transaction statistics per user

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_id` | UUID | - | Foreign key to `auth.users` (UNIQUE) |
| `total_transactions` | INTEGER | `0` | Total number of transactions |
| `total_sent` | DECIMAL(20, 8) | `0` | Total amount sent |
| `total_received` | DECIMAL(20, 8) | `0` | Total amount received |
| `total_gas_spent` | DECIMAL(20, 8) | `0` | Total gas/fees spent |
| `favorite_token` | TEXT | NULL | Most used token |
| `last_transaction_at` | TIMESTAMPTZ | NULL | Last transaction time |
| `updated_at` | TIMESTAMPTZ | `NOW()` | Last update time |

**RLS:** Users can read own stats. Triggers can insert/update.

---

### 7. `transaction_notes`
**Purpose:** Store personal notes for transactions

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to `auth.users` |
| `chain_key` | VARCHAR(50) | Chain identifier (e.g., 'ethereum', 'solana') |
| `tx_hash` | VARCHAR(255) | Transaction hash |
| `note` | TEXT | User's personal note |
| `created_at` | TIMESTAMPTZ | Note creation time |
| `updated_at` | TIMESTAMPTZ | Last update time |

**Indexes:**
- `idx_transaction_notes_user_chain` on `(user_id, chain_key)`
- `idx_transaction_notes_tx_hash` on `tx_hash`

**Unique constraint:** `(user_id, chain_key, tx_hash)`

**RLS:** Users can fully manage own notes.

---

### 8. `failed_login_attempts`
**Purpose:** Track failed login attempts for rate limiting

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_identifier` | VARCHAR(255) | - | Email or wallet address (UNIQUE) |
| `attempt_count` | INTEGER | `1` | Number of failed attempts |
| `last_attempt_at` | TIMESTAMPTZ | `NOW()` | Last failed attempt time |
| `locked_until` | TIMESTAMPTZ | NULL | Account locked until this time |
| `ip_address` | VARCHAR(45) | NULL | IP address (IPv4 or IPv6) |
| `user_agent` | TEXT | NULL | Browser user agent |
| `created_at` | TIMESTAMPTZ | `NOW()` | First attempt time |

**Indexes:**
- `idx_failed_login_user` on `user_identifier`
- `idx_failed_login_locked` on `locked_until` (partial index)

**RLS:** Users can read own attempts only.

---

## Functions

### 1. `mark_user_unverified(user_id UUID)`
**Purpose:** Mark a newly signed up user as unverified

**Security:** `SECURITY DEFINER`  
**Returns:** `void`  
**Permissions:** `authenticated`, `service_role`

**What it does:**
- Sets `email_confirmed_at` to NULL
- Sets `confirmation_sent_at` to NOW()
- Updates `updated_at` timestamp

**Used by:** `/api/send-welcome-email` after user signup

---

### 2. `calculate_security_score(p_user_id UUID)`
**Purpose:** Calculate user security score based on enabled features

**Security:** `SECURITY DEFINER`  
**Returns:** `INTEGER` (0-100)  
**Permissions:** `authenticated`, `service_role`

**Score breakdown:**
- Base score (having an account): **20 points**
- Email verified: **20 points**
- 2FA enabled: **25 points**
- Has trusted device: **20 points**
- Active in last 7 days: **15 points**

**What it does:**
1. Checks if email is verified (`auth.users.email_confirmed_at`)
2. Checks if 2FA is enabled (`user_profiles.two_factor_enabled`)
3. Checks if user has verified trusted devices
4. Checks if user has recent activity
5. Calculates total score
6. Updates or inserts into `user_security_scores`

---

### 3. `log_user_activity(...)`
**Purpose:** Log user activity to activity log

**Parameters:**
- `p_user_id` UUID
- `p_activity_type` TEXT
- `p_description` TEXT
- `p_ip_address` TEXT (optional)
- `p_device_info` TEXT (optional)
- `p_metadata` JSONB (optional)

**Security:** `SECURITY DEFINER`  
**Returns:** UUID (activity log ID)  
**Permissions:** `authenticated`, `service_role`

**What it does:**
- Inserts a new row into `user_activity_log`
- Returns the ID of the created activity

---

### 4. `update_updated_at_column()`
**Purpose:** Trigger function to auto-update `updated_at` timestamp

**Returns:** TRIGGER  
**Used by:** Triggers on `user_profiles`, `user_security_scores`, `transaction_notes`

**What it does:**
- Sets `NEW.updated_at = NOW()`
- Returns NEW row

---

### 5. `create_user_profile_on_signup()`
**Purpose:** Automatically create profile, security score, and transaction stats on signup

**Security:** `SECURITY DEFINER`  
**Returns:** TRIGGER  
**Used by:** Trigger `on_auth_user_created` on `auth.users`

**What it does:**
1. Creates `user_profiles` row with default values
2. Creates `user_security_scores` row
3. Creates `user_transaction_stats` row
4. Uses `display_name` from `raw_user_meta_data.name` if available

---

## Triggers

### 1. `update_user_profiles_updated_at`
**Table:** `user_profiles`  
**Event:** BEFORE UPDATE  
**Function:** `update_updated_at_column()`

Auto-updates `updated_at` timestamp on profile updates.

---

### 2. `update_security_scores_updated_at`
**Table:** `user_security_scores`  
**Event:** BEFORE UPDATE  
**Function:** `update_updated_at_column()`

Auto-updates `updated_at` timestamp on security score updates.

---

### 3. `update_transaction_notes_updated_at`
**Table:** `transaction_notes`  
**Event:** BEFORE UPDATE  
**Function:** `update_updated_at_column()`

Auto-updates `updated_at` timestamp on transaction note updates.

---

### 4. `on_auth_user_created`
**Table:** `auth.users`  
**Event:** AFTER INSERT  
**Function:** `create_user_profile_on_signup()`

Automatically creates profile, security score, and transaction stats for new users.

---

## RLS Policies

### Policy Structure

All tables have **Row Level Security (RLS) enabled**.

**General pattern:**
1. **Authenticated users** can read/update **own data** (`auth.uid() = user_id`)
2. **Triggers** can insert data (`auth.uid() IS NULL`)
3. **Service role** has **full access** (`USING (true)`)

### Example Policies

#### user_profiles
- `"Users can read own profile"` - SELECT for authenticated where `auth.uid() = user_id`
- `"Users can update own profile"` - UPDATE for authenticated where `auth.uid() = user_id`
- `"Allow inserts on user_profiles"` - INSERT when `auth.uid() IS NULL OR auth.uid() = user_id`
- `"Service role full access on user_profiles"` - ALL for service_role

#### transaction_notes
- `"Users can manage own transaction notes"` - ALL for authenticated where `auth.uid() = user_id`
- `"Service role full access on transaction_notes"` - ALL for service_role

#### email_verification_tokens
- `"Service role can do everything on email_verification_tokens"` - ALL for service_role only

---

## Storage

### Bucket: `user-uploads`
**Public:** Yes  
**Purpose:** Store user avatars

### Folder Structure
```
user-uploads/
└── avatars/
    └── {user_id}/
        └── avatar.png (or .jpg, .webp, etc.)
```

### Storage Policies

1. **Users can upload their own avatar**
   - INSERT for authenticated
   - Path must be `avatars/{auth.uid()}/...`

2. **Anyone can view avatars**
   - SELECT for public
   - Any path in `avatars/` folder

3. **Users can delete their own avatar**
   - DELETE for authenticated
   - Path must be `avatars/{auth.uid()}/...`

---

## How to Use

### Option 1: Verify Current Database

Run this to check if your database is correctly configured:

```bash
# In Supabase SQL Editor
supabase_verify_database.sql
```

This will output a detailed report showing:
- ✅ What's correctly configured
- ❌ What's missing
- ⚠️ What needs attention

### Option 2: Complete Reset (⚠️ DESTRUCTIVE)

If you need to completely rebuild the database:

```bash
# ⚠️ WARNING: This will DELETE ALL DATA!
# In Supabase SQL Editor
supabase_complete_reset.sql
```

This will:
1. Drop all existing tables
2. Drop all functions and triggers
3. Recreate everything from scratch
4. Clean up orphaned users

### Option 3: Manual Migration

If you only need to fix specific issues, you can run individual migration files:

```sql
-- Example: Add missing auto_lock_timeout column
\i supabase/migrations/20251117120000_add_auto_lock_timeout.sql

-- Example: Fix RLS policies
\i supabase/migrations/20251117110000_fix_rls_policies.sql
```

---

## Troubleshooting

### "Users are being created but no profile"
**Cause:** Trigger `on_auth_user_created` is not firing or RLS is blocking inserts.

**Fix:**
1. Check if trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';`
2. Check RLS policies allow trigger inserts (`auth.uid() IS NULL`)
3. Run `supabase_complete_reset.sql` to recreate everything

### "403 Forbidden" or "406 Not Acceptable" errors
**Cause:** RLS policies are too restrictive or missing.

**Fix:**
1. Run `supabase_verify_database.sql` to check policies
2. Run `supabase/migrations/20251117110000_fix_rls_policies.sql`
3. If still failing, run `supabase_complete_reset.sql`

### "Column does not exist" errors
**Cause:** Database schema is outdated.

**Fix:**
1. Check which columns are missing: `supabase_verify_database.sql`
2. Run individual migrations or full reset

---

## Summary

✅ **8 Tables** for user data, profiles, security, and transactions  
✅ **5 Functions** for automation and security calculations  
✅ **4 Triggers** for auto-creating profiles and updating timestamps  
✅ **30+ RLS Policies** to ensure data security  
✅ **1 Storage Bucket** for user avatars

**All database operations are secure** with Row Level Security enabled on every table.

---

*Last updated: November 21, 2025*  
*BLAZE Wallet v1.0*

