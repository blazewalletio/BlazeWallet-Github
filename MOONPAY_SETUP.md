# 🔥 MOONPAY INTEGRATION - SETUP GUIDE

**Datum:** 15 December 2025  
**Status:** ✅ **IMPLEMENTATIE COMPLEET**

---

## 📋 OVERZICHT

MoonPay is nu volledig geïmplementeerd ter vervanging van Onramper. De buy functionaliteit gebruikt nu een **embedded widget** binnen de Blaze UI, zonder popups of externe redirects.

---

## ✨ FEATURES

### ✅ Volledige Functionaliteit
- **Embedded widget** - Volledig binnen Blaze modal, geen popups
- **Real-time quotes** - Live exchange rates van MoonPay API
- **Multi-chain support** - Automatische crypto selectie per chain
- **Auto wallet address** - Wordt automatisch ingevuld
- **KYC onthouden** - Na eerste keer niet meer nodig
- **Transaction tracking** - Real-time status updates via webhooks
- **Error handling** - Duidelijke foutmeldingen
- **Loading states** - Smooth UX tijdens API calls

### 🎨 UI/UX
- **Blaze Wallet theming** - Orange-yellow gradients
- **Glassmorphism design** - Consistent met rest van app
- **Smooth animations** - Framer Motion transitions
- **Responsive design** - Werkt perfect op mobile en desktop
- **Quick amount buttons** - €50, €100, €250, €500
- **Auto-quote fetching** - Real-time updates bij amount changes

---

## 🔑 ENVIRONMENT VARIABLES

### Vereist voor Production

Voeg deze environment variables toe aan Vercel:

```bash
# MoonPay API Keys (verkrijg via https://www.moonpay.com/dashboard)
MOONPAY_API_KEY=pk_live_...          # Public API key (voor frontend/widget)
MOONPAY_SECRET_KEY=sk_live_...       # Secret key (voor webhook signing)

# Environment (optioneel, default: production)
MOONPAY_ENVIRONMENT=production        # of 'sandbox' voor testing
```

### Voor Development/Testing

```bash
# MoonPay Sandbox Keys (verkrijg via MoonPay dashboard)
MOONPAY_API_KEY=pk_test_...          # Sandbox public key
MOONPAY_SECRET_KEY=sk_test_...       # Sandbox secret key
MOONPAY_ENVIRONMENT=sandbox          # Gebruik sandbox mode
```

---

## 🚀 SETUP STAPPEN

### 1. MoonPay Account Aanmaken

1. Ga naar https://www.moonpay.com
2. Klik op "Get Started" of "Sign Up"
3. Voltooi de registratie
4. Verifieer je account (KYC voor business accounts)

### 2. API Keys Ophalen

1. Log in op MoonPay Dashboard: https://www.moonpay.com/dashboard
2. Ga naar **Settings** → **API Keys**
3. Kopieer je **Public Key** (begint met `pk_live_` of `pk_test_`)
4. Kopieer je **Secret Key** (begint met `sk_live_` of `sk_test_`)

### 3. Environment Variables Toevoegen aan Vercel

```bash
# Via Vercel CLI
vercel env add MOONPAY_API_KEY production
# Plak je public key wanneer gevraagd

vercel env add MOONPAY_SECRET_KEY production
# Plak je secret key wanneer gevraagd

# Optioneel: voor sandbox testing
vercel env add MOONPAY_ENVIRONMENT production
# Type: sandbox (of laat leeg voor production)
```

Of via Vercel Dashboard:
1. Ga naar je project → **Settings** → **Environment Variables**
2. Voeg toe:
   - `MOONPAY_API_KEY` = `pk_live_...`
   - `MOONPAY_SECRET_KEY` = `sk_live_...`
   - `MOONPAY_ENVIRONMENT` = `production` (of `sandbox`)

### 4. Webhook Configureren

1. Ga naar MoonPay Dashboard → **Settings** → **Webhooks**
2. Voeg webhook URL toe: `https://my.blazewallet.io/api/moonpay/webhook`
3. Kopieer de webhook secret (als die wordt gegeven)
4. Test de webhook (MoonPay heeft een test functie)

---

## 🏗️ ARCHITECTUUR

### Component Structuur
```
BuyModal.tsx
├── Step 1: Select (Amount, Crypto, Fiat)
├── Step 2: Widget (MoonPay embedded iframe)
├── Step 3: Processing (Loading state)
├── Step 4: Success (Confirmation)
└── Step 5: Error (Error handling)
```

### API Routes
```
/api/moonpay/quote          → GET  → Real-time quotes
/api/moonpay/widget-url    → POST → Generate widget URL
/api/moonpay/webhook       → POST → Transaction status updates
```

### Flow
```
1. User clicks "Buy" button
   ↓
2. User selects amount, crypto, fiat
   ↓
3. Real-time quote fetched from MoonPay
   ↓
4. User clicks "Buy now"
   ↓
5. Widget URL generated with wallet address
   ↓
6. MoonPay embedded iframe loaded in modal
   ↓
7. User completes payment in iframe
   ↓
8. Webhook receives status update
   ↓
9. Success/Error screen shown
```

---

## 🧪 TESTEN

### Sandbox Mode

1. Zet `MOONPAY_ENVIRONMENT=sandbox` in Vercel
2. Gebruik sandbox API keys
3. Test de buy flow met test credit cards
4. Verifieer dat webhooks werken

### Production Testing

1. Zet `MOONPAY_ENVIRONMENT=production` (of laat leeg)
2. Gebruik production API keys
3. Test met kleine bedragen eerst
4. Monitor webhook deliveries

---

## 📝 BELANGRIJKE NOTITIES

### Widget URL Parameters

De MoonPay widget URL bevat:
- `apiKey` - Public API key
- `walletAddress` - User's wallet address (auto-filled)
- `currencyCode` - Selected crypto (e.g., 'eth', 'sol')
- `baseCurrencyCode` - Selected fiat (e.g., 'eur', 'usd')
- `baseCurrencyAmount` - Amount in fiat
- `theme` - 'light' or 'dark'
- `mode` - 'buy' or 'sell'
- `showWalletAddressForm` - 'false' (we provide it)
- `redirectURL` - URL to redirect after completion

### Webhook Events

MoonPay webhooks kunnen de volgende events sturen:
- `transaction_updated` - Transaction status changed
  - Status: `pending`, `waitingPayment`, `waitingAuthorization`, 
    `processingPayment`, `pendingRefund`, `completed`, `failed`, `expired`

### Supported Cryptocurrencies

MoonPay ondersteunt:
- **Ethereum**: ETH, USDC, USDT, DAI, WBTC, LINK, UNI, AAVE
- **Polygon**: MATIC, USDC, USDT
- **BSC**: BNB, USDT, BUSD
- **Arbitrum**: ETH, USDC, USDT
- **Optimism**: ETH, USDC, USDT
- **Base**: ETH, USDC
- **Avalanche**: AVAX, USDC, USDT
- **Solana**: SOL, USDC_SOL, USDT_SOL

### Supported Fiat Currencies

MoonPay ondersteunt 50+ fiat currencies, waaronder:
- EUR, USD, GBP, CAD, AUD, JPY, CHF, NOK, SEK, DKK, en meer

---

## 🎉 CONCLUSIE

**MoonPay is volledig geïmplementeerd!**

- ✅ Embedded widget (geen popups)
- ✅ Auto wallet address
- ✅ KYC onthouden
- ✅ Wereldwijde dekking
- ✅ Betrouwbaar en bekend

**Volgende stappen:**
1. MoonPay account aanmaken
2. API keys ophalen
3. Environment variables toevoegen aan Vercel
4. Webhook configureren
5. Testen in sandbox
6. Deploy naar production

---

*Setup guide opgesteld: 15 December 2025*

