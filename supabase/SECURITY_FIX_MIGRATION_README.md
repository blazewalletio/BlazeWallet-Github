# 🔒 Security Fix Migration - Instructies

## Overzicht

Deze migration lost **alle** Supabase database linter errors en warnings op:

### ✅ ERRORS GEFIXT:
1. **RLS Disabled in Public Tables** - `scheduled_transactions`, `admin_actions`, `address_book`
2. **Policy Exists RLS Disabled** - `scheduled_transactions`
3. **Security Definer Views** - `referral_leaderboard`, `priority_list_stats`

### ✅ WARNINGS GEFIXT:
1. **Function Search Path Mutable** - Alle functions hebben nu `SET search_path = ''`
2. **Materialized View in API** - `address_book_stats` is nu RLS protected
3. **Extension in Public** - Notitie toegevoegd (optioneel om te verplaatsen)

### ⚠️ MANUELE ACTIE NODIG:
- **Auth Leaked Password Protection** - Moet handmatig worden enabled in Supabase Dashboard

---

## 🚀 Hoe te Uitvoeren

### Stap 1: Open Supabase Dashboard
1. Ga naar: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Klik op **"SQL Editor"** in het linker menu

### Stap 2: Voer Migration Uit
1. Klik op **"+ New query"**
2. Geef het een naam: "Security Fix Migration"
3. Open het bestand: `supabase/migrations/20251215000000_fix_all_security_issues.sql`
4. **Kopieer de volledige inhoud** (990+ regels)
5. Plak in de SQL Editor
6. Klik op **"Run"** (of druk Cmd+Enter / Ctrl+Enter)

### Stap 3: Verificatie
Na het uitvoeren zou je moeten zien:
```
✅ All security issues fixed successfully!
```

### Stap 4: Check Linter
1. Ga naar Supabase Dashboard → **Database** → **Linter**
2. Alle errors zouden nu opgelost moeten zijn
3. Warnings zouden ook opgelost moeten zijn (behalve extension in public, dat is optioneel)

---

## 📋 Wat de Migration Doet

### 1. RLS (Row Level Security) Fixes

#### `scheduled_transactions`
- ✅ Enable RLS (policies bestaan al)
- Gebruikers kunnen alleen hun eigen scheduled transactions zien

#### `admin_actions`
- ✅ Enable RLS
- ✅ Create policies (alleen service_role kan toegang krijgen)
- Admin acties zijn nu volledig beveiligd

#### `address_book`
- ✅ Enable RLS
- ✅ Create policies (ondersteunt zowel Supabase auth als wallet-based auth)
- Gebruikers kunnen alleen hun eigen contacts zien

### 2. Security Definer Views Fixes

#### `priority_list_stats`
- ✅ Herdefinieerd ZONDER `SECURITY DEFINER`
- Respecteert nu RLS van de base table
- Veiliger en volgt best practices

#### `referral_leaderboard`
- ✅ Herdefinieerd ZONDER `SECURITY DEFINER`
- Respecteert nu RLS van de base table
- Veiliger en volgt best practices

### 3. Function Search Path Fixes

**Alle functions** hebben nu `SET search_path = ''` toegevoegd:
- ✅ Voorkomt SQL injection via search_path manipulation
- ✅ Alle functions gebruiken nu expliciete schema qualifiers (`public.table_name`)
- ✅ Veiliger en volgt PostgreSQL security best practices

**Functions die zijn gefixed:**
- `update_scheduled_transactions_updated_at()`
- `calculate_next_execution()`
- `update_user_savings_stats()`
- `get_ready_transactions()`
- `cleanup_old_gas_history()`
- `get_gas_stats_24h()`
- `get_user_total_savings()`
- `check_gas_alerts()`
- `update_address_book_updated_at()`
- `refresh_address_book_stats()`
- `search_contacts()`
- `get_contact_by_address()`
- `check_and_increment_rate_limit()`
- `cleanup_expired_ai_cache()`
- `get_user_wallet()`
- `update_updated_at_column()`
- `update_transaction_note_timestamp()`
- `cleanup_old_audit_logs()`
- `cleanup_expired_auth()`
- `log_user_activity()`
- `log_network_settings_change()`
- `record_failed_login_attempt()`
- `is_user_locked()`
- `clear_failed_login_attempts()`
- `cleanup_old_failed_attempts()`
- `calculate_security_score()`
- `generate_referral_code()`
- `is_email_registered()`
- `create_user_with_identity()`
- `set_position_number()`
- `mark_email_verified()`
- `track_new_user_email()`
- `log_network_settings_change()`
- En meer...

### 4. Materialized View Fix

#### `address_book_stats`
- ✅ Directe toegang via API is nu geblokkeerd (`REVOKE SELECT`)
- ✅ Nieuwe secure function: `get_address_book_stats(p_user_id UUID)`
- ✅ Gebruikers kunnen alleen hun eigen stats zien via de function
- ✅ RLS wordt gerespecteerd via de underlying table

**Gebruik:**
```sql
-- Oud (niet meer toegestaan):
SELECT * FROM address_book_stats;

-- Nieuw (veilig):
SELECT * FROM get_address_book_stats('user-uuid-here');
```

### 5. Extension in Public (Optioneel)

De `pg_net` extension staat nog in het `public` schema. Dit is een warning, geen error.

**Om dit op te lossen (optioneel):**
1. Uncomment de code in PART 4 van de migration
2. Dit zal de extension verplaatsen naar een `extensions` schema
3. **LET OP:** Dit kan bestaande functionaliteit breken als `pg_net` actief wordt gebruikt

---

## ⚠️ MANUELE ACTIE: Auth Leaked Password Protection

Deze setting kan **NIET** via SQL worden gefixed. Het moet handmatig worden enabled in het Supabase Dashboard:

### Stap 1: Ga naar Auth Settings
1. Supabase Dashboard → **Authentication** → **Settings**
2. Scroll naar **"Password Security"**

### Stap 2: Enable Leaked Password Protection
1. Zet **"Leaked Password Protection"** aan
2. Dit checkt wachtwoorden tegen HaveIBeenPwned.org database
3. Voorkomt dat gebruikers gecompromitteerde wachtwoorden gebruiken

### Stap 3: Save
1. Klik op **"Save"**
2. De warning zou nu moeten verdwijnen in de linter

---

## 🔍 Verificatie Checklist

Na het uitvoeren van de migration, check:

- [ ] `scheduled_transactions` heeft RLS enabled
- [ ] `admin_actions` heeft RLS enabled en policies
- [ ] `address_book` heeft RLS enabled en policies
- [ ] `priority_list_stats` view heeft geen SECURITY DEFINER
- [ ] `referral_leaderboard` view heeft geen SECURITY DEFINER
- [ ] Alle functions hebben `SET search_path = ''`
- [ ] `address_book_stats` is niet direct toegankelijk via API
- [ ] `get_address_book_stats()` function werkt
- [ ] Supabase Linter toont geen errors meer
- [ ] Auth Leaked Password Protection is enabled (handmatig)

---

## 🐛 Troubleshooting

### Error: "relation does not exist"
- **Oorzaak:** Een table of function bestaat nog niet
- **Oplossing:** Voer eerst de eerdere migrations uit (01-wallets, 03-ai-cache, 04-gas-optimizer, 05-smart-scheduler, etc.)

### Error: "permission denied"
- **Oorzaak:** Je hebt niet de juiste rechten
- **Oplossing:** Zorg dat je de migration uitvoert als `postgres` user of service_role

### Warning blijft bestaan na migration
- **Oorzaak:** Linter cache
- **Oplossing:** Wacht 5-10 minuten en refresh de linter pagina

### Function werkt niet meer
- **Oorzaak:** `SET search_path = ''` vereist expliciete schema qualifiers
- **Oplossing:** Check of alle table references `public.` prefix hebben

---

## 📝 Notes

- Deze migration is **idempotent** - je kunt het meerdere keren uitvoeren zonder problemen
- Alle bestaande data blijft intact
- Geen downtime vereist
- Backward compatible met bestaande code

---

## ✅ Success!

Als alles goed is gegaan, zou je nu:
- ✅ Geen errors meer moeten zien in de Supabase linter
- ✅ Alle warnings opgelost moeten hebben (behalve extension in public, dat is optioneel)
- ✅ Een veel veiligere database hebben

**Gefeliciteerd! 🎉**

