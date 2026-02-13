# 🔧 COMPLETE ONRAMPER FIX PROPOSAL

## 📊 PROBLEEM ANALYSE

### 1. BANXA iDeal | Wero Quote Probleem
**Probleem**: BANXA heeft voor iDeal | Wero `payout: undefined` en `rate: undefined`, maar voor andere payment methods (applepay, creditcard) wel payout/rate.

**Oorzaak**: Onramper geeft voor iDeal | Wero geen complete quote voor BANXA. Dit is een Onramper API beperking, niet onze code.

**Oplossing**: 
- Accepteer quotes ZONDER payout/rate als ze expliciet `paymentMethod: 'ideal'` hebben
- Toon in UI dat quote wordt berekend tijdens checkout
- Gebruik `fiatAmount / estimatedRate` als fallback voor display

### 2. Invalid Webhook Signatures
**Probleem**: Veel 401 errors voor Onramper webhooks met "Invalid webhook signature".

**Oorzaken**:
- Webhook secret niet correct geconfigureerd in Vercel
- Signature validatie gebruikt verkeerde algoritme/format
- Onramper gebruikt mogelijk andere signature methode

**Oplossing**:
- Verbeter signature validatie met meerdere formaten
- Log webhook payload en signature voor debugging
- Maak signature validatie optioneel (met warning) als secret niet geconfigureerd is
- Documenteer correcte webhook secret setup

### 3. Webhooks Updaten Database Niet
**Probleem**: Webhook handlers loggen alleen, updaten database niet. UI toont nog steeds "successful" na annulering.

**Oorzaak**: Geen database tabel voor onramp transactions + TODO's in code.

**Oplossing**:
- Maak `onramp_transactions` tabel in Supabase
- Implementeer database updates in webhook handlers
- Poll transaction status via Onramper API als backup
- Update UI om real-time status te tonen

### 4. Geen Database Tabel voor Onramp Transactions
**Probleem**: Geen manier om transaction statuses op te slaan en te tonen in UI.

**Oplossing**:
- Maak `onramp_transactions` tabel met alle relevante velden
- Link naar user via `user_id`
- Store transaction details (provider, amount, status, etc.)
- Maak UI component om onramp transactions te tonen

---

## 🎯 IMPLEMENTATIE PLAN

### STAP 1: Database Schema
```sql
CREATE TABLE onramp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction Identifiers
  onramp_transaction_id TEXT NOT NULL UNIQUE, -- Onramper transaction ID
  provider TEXT NOT NULL, -- 'banxa', 'moonpay', etc.
  
  -- Transaction Details
  fiat_amount DECIMAL(20, 2) NOT NULL,
  fiat_currency TEXT NOT NULL,
  crypto_amount DECIMAL(20, 8),
  crypto_currency TEXT NOT NULL,
  payment_method TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, cancelled, refunded
  status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Wallet Info
  wallet_address TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT onramp_transactions_user_idx UNIQUE (user_id, onramp_transaction_id)
);

CREATE INDEX idx_onramp_transactions_user ON onramp_transactions(user_id, status);
CREATE INDEX idx_onramp_transactions_status ON onramp_transactions(status, status_updated_at);
CREATE INDEX idx_onramp_transactions_provider ON onramp_transactions(provider, status);
```

### STAP 2: Fix BANXA iDeal | Wero Quote Display
**Bestand**: `components/BuyModal3.tsx`

**Wijzigingen**:
1. Accepteer quotes zonder payout/rate als `paymentMethod` matcht
2. Toon "Quote wordt berekend tijdens checkout" message
3. Gebruik `fiatAmount / estimatedRate` als fallback voor display
4. Enable "Buy now" button zelfs zonder payout (quote wordt tijdens checkout berekend)

### STAP 3: Fix Webhook Signature Validatie
**Bestand**: `app/api/onramper/webhook/route.ts`

**Wijzigingen**:
1. Probeer meerdere signature formaten (hex, base64, etc.)
2. Log webhook payload en signature voor debugging
3. Maak signature validatie optioneel met warning als secret niet geconfigureerd
4. Verbeter error messages

### STAP 4: Implementeer Database Updates in Webhooks
**Bestanden**: 
- `app/api/onramper/webhook/route.ts`
- `app/api/moonpay/webhook/route.ts`

**Wijzigingen**:
1. Update `onramp_transactions` tabel bij status changes
2. Notify user via real-time updates (Supabase Realtime)
3. Poll transaction status als backup (voor missed webhooks)

### STAP 5: Maak Onramp Transactions UI Component
**Bestand**: `components/OnrampTransactionsPanel.tsx` (nieuw)

**Functionaliteit**:
- Toon alle onramp transactions voor user
- Real-time status updates
- Filter op provider, status, payment method
- Link naar provider dashboard voor details

### STAP 6: Integreer in Dashboard
**Bestand**: `components/Dashboard.tsx`

**Wijzigingen**:
- Voeg "Recent Purchases" sectie toe
- Toon laatste 5 onramp transactions
- Link naar volledige lijst

---

## 🔒 SECURITY CONSIDERATIONS

1. **Webhook Secret**: Zorg dat `ONRAMPER_WEBHOOK_SECRET` correct is geconfigureerd in Vercel
2. **RLS Policies**: Maak Row Level Security policies voor `onramp_transactions` tabel
3. **Rate Limiting**: Voeg rate limiting toe aan webhook endpoints
4. **Input Validation**: Valideer alle webhook payloads

---

## 📝 TESTING CHECKLIST

- [ ] BANXA iDeal | Wero quote wordt getoond (zelfs zonder payout/rate)
- [ ] "Buy now" button werkt voor iDeal | Wero quotes zonder payout
- [ ] Webhook signatures worden correct gevalideerd
- [ ] Database wordt geüpdatet bij webhook events
- [ ] UI toont correcte status na annulering
- [ ] Real-time updates werken
- [ ] Polling backup werkt voor missed webhooks

---

## 🚀 DEPLOYMENT STEPS

1. Run database migration voor `onramp_transactions` tabel
2. Configureer `ONRAMPER_WEBHOOK_SECRET` in Vercel
3. Deploy code changes
4. Test webhook endpoints met Onramper test tool
5. Monitor logs voor webhook events
6. Verify database updates

---

## 📚 DOCUMENTATION

- Documenteer webhook secret setup in Vercel
- Documenteer Onramper transaction flow
- Documenteer polling mechanism als backup
