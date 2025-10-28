# 🔐 Supabase Auth Setup - BLAZE Wallet

## 📋 Stap 1: Run SQL Migration

1. **Open Supabase SQL Editor:**
   - Ga naar: https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/sql/new

2. **Plak de SQL:**
   - Open `supabase-migrations/01-wallets-table.sql`
   - Kopieer ALLES
   - Plak in SQL editor

3. **Run:**
   - Klik **"RUN"** (rechtsonder)
   - Wacht tot "Success" melding verschijnt

---

## 📧 Stap 2: Enable Email Authentication

1. **Open Auth Settings:**
   - Ga naar: https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/auth/providers

2. **Email Provider:**
   - Klik op **"Email"**
   - Zet **"Enable Email provider"** AAN (toggle)
   - **"Enable email confirmations"**: OPTIONEEL (voor nu: UIT voor sneller testen)
   - Klik **"Save"**

---

## 🌐 Stap 3: Configure Site URL (belangrijk!)

1. **Open URL Configuration:**
   - Ga naar: https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/auth/url-configuration

2. **Set Site URL:**
   ```
   https://my.blazewallet.io
   ```

3. **Add Redirect URLs:**
   ```
   https://my.blazewallet.io
   https://my.blazewallet.io/auth/callback
   https://my.blazewallet.io/**
   http://localhost:3000 (voor development)
   http://localhost:3000/auth/callback
   ```

4. Klik **"Save"**

---

## 🔍 Stap 4: Google OAuth (Optioneel - kan later)

### 4.1 Create Google OAuth Client

1. **Ga naar Google Cloud Console:**
   - https://console.cloud.google.com/apis/credentials

2. **Create Project** (als je nog geen project hebt)
   - Project name: "BLAZE Wallet"

3. **Configure OAuth Consent Screen:**
   - User Type: **External**
   - App name: **BLAZE Wallet**
   - User support email: **info@blazewallet.io**
   - Developer contact: **info@blazewallet.io**
   - Klik **"Save and Continue"**

4. **Create OAuth 2.0 Client ID:**
   - Klik **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
   - Application type: **Web application**
   - Name: **BLAZE Wallet Web**
   
   **Authorized JavaScript origins:**
   ```
   https://my.blazewallet.io
   http://localhost:3000
   ```
   
   **Authorized redirect URIs:**
   ```
   https://ldehmephukevxumwdbwt.supabase.co/auth/v1/callback
   http://localhost:54321/auth/v1/callback
   ```

5. **Kopieer credentials:**
   - Client ID: `xxx.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-xxx`

### 4.2 Enable in Supabase

1. **Ga naar:**
   - https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/auth/providers

2. **Google Provider:**
   - Klik op **"Google"**
   - Zet **"Enable Sign in with Google"** AAN
   - **Client ID:** [plak hier]
   - **Client Secret:** [plak hier]
   - Klik **"Save"**

---

## 🍎 Stap 5: Apple Sign-In (Optioneel - kan later)

### 5.1 Create Apple Service ID

1. **Ga naar Apple Developer:**
   - https://developer.apple.com/account/resources/identifiers/list/serviceId

2. **Register a Services ID:**
   - Description: **BLAZE Wallet**
   - Identifier: **io.blazewallet.auth** (moet uniek zijn)
   
3. **Configure Sign In with Apple:**
   - Enable **"Sign In with Apple"**
   - **Primary App ID:** [select your app]
   - **Web Domain:** `my.blazewallet.io`
   - **Return URLs:**
   ```
   https://ldehmephukevxumwdbwt.supabase.co/auth/v1/callback
   ```

4. **Create a Key:**
   - Ga naar: https://developer.apple.com/account/resources/authkeys/list
   - Klik **"+"**
   - Key Name: **BLAZE Wallet Sign In**
   - Enable **"Sign In with Apple"**
   - Configure → Select Primary App ID
   - Register
   - **Download .p8 file** (bewaar veilig!)

5. **Kopieer credentials:**
   - Services ID: `io.blazewallet.auth`
   - Team ID: (vind je in Apple Developer account)
   - Key ID: (van de key die je net maakte)
   - Private Key: (inhoud van .p8 file)

### 5.2 Enable in Supabase

1. **Ga naar:**
   - https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/auth/providers

2. **Apple Provider:**
   - Klik op **"Apple"**
   - Zet **"Enable Sign in with Apple"** AAN
   - **Services ID:** [plak hier]
   - **Team ID:** [plak hier]
   - **Key ID:** [plak hier]
   - **Private Key:** [plak hier - de .p8 inhoud]
   - Klik **"Save"**

---

## ✅ Verificatie

Na alle setup, test je installatie:

1. **Check Database:**
   ```sql
   SELECT * FROM public.wallets LIMIT 1;
   ```
   Moet een lege tabel tonen (no error)

2. **Check Auth:**
   - Ga naar: https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/auth/users
   - Moet "No users found" tonen (maar geen errors)

3. **Test Email Signup:**
   - Zal ik in de frontend implementeren
   - Dan kun je meteen testen!

---

## 🚀 Klaar!

Als stap 1 en 2 gedaan zijn, kan ik verder met de frontend integratie.

Google en Apple OAuth kun je later nog doen (niet kritiek voor launch).

