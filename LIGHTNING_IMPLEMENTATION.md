# ⚡ Lightning Network Implementation Guide

## Overview

Blaze Wallet now supports Lightning Network payments via a hybrid architecture:

- **Native Apps (iOS/Android)**: Full Breez SDK with Greenlight (non-custodial)
- **Web (PWA)**: WebLN fallback (uses user's own Lightning wallet)

## Architecture

```
┌─────────────────────────────────────────┐
│      Unified Lightning Service          │
│  (lib/lightning-service.ts)             │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌─────────────┐  ┌──────────────┐
│ Breez SDK   │  │   WebLN      │
│ (Native)    │  │   (Web)      │
│             │  │              │
│ Greenlight  │  │ User Wallet  │
│ Nodes       │  │ (Alby/Zeus)  │
└─────────────┘  └──────────────┘
```

## Setup Instructions

### 1. Environment Variables

Create `.env.local` in project root:

```bash
# Greenlight Certificate (required for native apps)
NEXT_PUBLIC_GREENLIGHT_CERT="MIIBdzCCASmgAwIBAgIHPpiBhVZRnTAFBgMrZXAwEDEOMAwGA1UEAxMFQnJlZXowHhcNMjUxMDMxMTIxNzQxWhcNMzUxMDI5MTIxNzQxWjAxMRUwEwYDVQQKEwxCbGF6ZSBXYWxsZXQxGDAWBgNVBAMTD1JpY2sgU2NobGltYmFjazAqMAUGAytlcAMhANCD9cvfIDwcoiDKKYdT9BunHLS2/OuKzV8NS0SzqV13o4GAMH4wDgYDVR0PAQH/BAQDAgWgMAwGA1UdEwEB/wQCMAAwHQYDVR0OBBYEFNo5o+5ea0sNMlW/75VgGJCv2AcJMB8GA1UdIwQYMBaAFN6q1pJW843ndJIW/Ey2ILJrKJhrMB4GA1UdEQQXMBWBE2luZm9AYmxhemV3YWxsZXQuaW8wBQYDK2VwA0EAondH5DUodz41j98M0eutl7zo2Mcq9f+w7BS70tD1g6d6NFREWi1bgae6eQXxI6fQI6TekXaBUifMfnUknAzxCQ=="

# Optional: Breez API key (not required)
# NEXT_PUBLIC_BREEZ_API_KEY=""
```

### 2. For Vercel Deployment

Add environment variable in Vercel dashboard:

1. Go to: **Settings → Environment Variables**
2. Add: `NEXT_PUBLIC_GREENLIGHT_CERT` with the certificate value
3. Select: **Production, Preview, Development**
4. Save and redeploy

### 3. Build Native Apps (Optional)

```bash
# Build Next.js
npm run build

# Add iOS platform
npx cap add ios
npx cap sync
npx cap open ios

# Add Android platform
npx cap add android
npx cap sync
npx cap open android
```

## Usage

### In Code

```typescript
import { lightningService } from '@/lib/lightning-service';

// Initialize (auto-detects platform)
await lightningService.initialize();

// Create invoice (receive)
const invoice = await lightningService.createInvoice(
  1000, // 1000 sats
  'Coffee payment'
);

// Pay invoice (send)
const result = await lightningService.payInvoice(invoice);

// Get balance (native only)
const balance = await lightningService.getBalance();

// Get transaction history (native only)
const txs = await lightningService.getTransactions();
```

### Platform Detection

```typescript
// Check platform
if (lightningService.isNativePlatform()) {
  console.log('Running on iOS/Android with Breez SDK');
} else {
  console.log('Running on web with WebLN fallback');
}

// Check features
if (lightningService.supportsBalance()) {
  const balance = await lightningService.getBalance();
}
```

## Features by Platform

### Native (iOS/Android) - Breez SDK + Greenlight

| Feature | Supported | Notes |
|---------|-----------|-------|
| Send payments | ✅ | Full Lightning Network support |
| Receive payments | ✅ | Generates BOLT11 invoices |
| Check balance | ✅ | Real-time balance updates |
| Transaction history | ✅ | Complete payment history |
| Invoice monitoring | ✅ | Real-time payment tracking |
| Offline support | ✅ | Pre-synced data |
| Non-custodial | ✅ | Keys stored on-device |

### Web (Desktop/Mobile PWA) - WebLN

| Feature | Supported | Notes |
|---------|-----------|-------|
| Send payments | ✅ | Via WebLN wallet (Alby, Zeus) |
| Receive payments | ✅ | Via WebLN wallet |
| Check balance | ❌ | Privacy: balance hidden |
| Transaction history | ❌ | Check wallet directly |
| Invoice monitoring | ❌ | Check wallet directly |
| Offline support | ❌ | Requires internet |
| Non-custodial | ✅ | Uses user's own wallet |

## WebLN Wallet Recommendations (Web)

For web users, recommend installing:

1. **Alby** - Browser extension (Chrome, Firefox, Safari)
   - https://getalby.com
   
2. **Zeus** - Mobile app with WebLN support
   - https://zeusln.com
   
3. **Mutiny Wallet** - Privacy-focused web wallet
   - https://www.mutinywallet.com

## Security

### Certificate Safety

The Greenlight certificate is **public-key based**:
- ✅ Safe to commit to repository
- ✅ Can be in environment variables
- ✅ Private keys generated on-device
- ✅ Non-custodial architecture

### Non-Custodial

Both implementations are non-custodial:
- **Native**: Keys stored on device, Breez hosts routing only
- **Web**: User controls their own WebLN wallet

## Troubleshooting

### Native App: "Breez SDK not available"

1. Check certificate in environment variables
2. Ensure Capacitor is properly initialized
3. Rebuild native apps: `npx cap sync`

### Web: "WebLN not available"

User needs to install a Lightning wallet:
```typescript
const guide = lightningService.getInstallGuide();
console.log(guide.url); // Installation guide
console.log(guide.wallets); // Recommended wallets
```

### Certificate Parsing Error

Ensure certificate format is correct:
- Remove PEM headers if present
- Keep as single base64 string
- Check for line breaks/whitespace

## Testing

### Test Native (iOS Simulator)

```bash
npm run build
npx cap sync
npx cap open ios
# Run in Xcode simulator
```

### Test Web (Local)

```bash
npm run dev
# Install Alby extension
# Open http://localhost:3000
```

### Test Production

```bash
# Web
https://my.blazewallet.io

# Native apps
Deploy to TestFlight (iOS) or Google Play Beta (Android)
```

## Technical Details

### Breez SDK (Native)

- **Technology**: Rust-based Lightning implementation
- **Node Type**: Greenlight (Blockstream hosted)
- **Connection**: gRPC via native modules
- **Storage**: On-device SQLite database

### WebLN (Web)

- **Technology**: JavaScript browser API
- **Node Type**: User's own Lightning wallet
- **Connection**: Browser extension communication
- **Storage**: User's wallet manages storage

## Future Enhancements

- [ ] Submarine swaps (on-chain ↔ Lightning)
- [ ] LNURL support (pay, withdraw, auth)
- [ ] Lightning Address support
- [ ] Channel management UI
- [ ] Routing fee optimization
- [ ] Multi-path payments (MPP)

## Support

For issues or questions:
- Breez SDK: https://sdk-doc.breez.technology
- WebLN: https://www.webln.guide
- Blaze Wallet: info@blazewallet.io

---

**Certificate Info:**
- Issuer: Breez
- Subject: Blaze Wallet (Rick Schlimback)
- Valid: 2025-10-31 to 2035-10-29 (10 years)
- Type: Ed25519 X.509 certificate

