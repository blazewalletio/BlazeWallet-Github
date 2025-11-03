# 🚀 Breez SDK Greenlight Lightning Implementation Plan

## 📋 Status: Phase 1 Complete (Infrastructure)

### ✅ What's Done:

1. **Frontend Service** (`lib/lightning-greenlight-service.ts`)
   - Full TypeScript service with all Lightning methods
   - Initialize node, create invoices, pay invoices
   - Check status, decode invoices, get balance
   - Works on both mobile and desktop

2. **Backend API Routes** (`app/api/lightning/*`)
   - `/init` - Initialize Greenlight node
   - `/balance` - Get channel balance
   - `/invoice` - Create invoice (receive)
   - `/pay` - Pay invoice (send)
   - `/decode` - Decode BOLT11 invoice
   - `/node` - Get node info
   - `/history` - Get payment history

3. **Mock Responses**
   - All endpoints return realistic mock data
   - Can test full UX flow without actual Greenlight connection
   - Perfect for development and testing

### 🔧 What Needs to Be Done (Phase 2):

#### 1. **Install Greenlight gRPC Client**
```bash
npm install @blockstream/greenlight-web
```

This is the official Greenlight client for web/Node.js.

#### 2. **Update Environment Variables**
Add to `.env.local`:
```
GREENLIGHT_CERT="MIIBdzCCASmgAwIBAgIHPpiBhVZRnTAFBgMrZXAwEDEOMAwGA1UEAxMFQnJlZXowHhcNMjUxMDMxMTIxNzQxWhcNMzUxMDI5MTIxNzQxWjAxMRUwEwYDVQQKEwxCbGF6ZSBXYWxsZXQxGDAWBgNVBAMTD1JpY2sgU2NobGltYmFjazAqMAUGAytlcAMhANCD9cvfIDwcoiDKKYdT9BunHLS2/OuKzV8NS0SzqV13o4GAMH4wDgYDVR0PAQH/BAQDAgWgMAwGA1UdEwEB/wQCMAAwHQYDVR0OBBYEFNo5o+5ea0sNMlW/75VgGJCv2AcJMB8GA1UdIwQYMBaAFN6q1pJW843ndJIW/Ey2ILJrKJhrMB4GA1UdEQQXMBWBE2luZm9AYmxhemV3YWxsZXQuaW8wBQYDK2VwA0EAondH5DUodz41j98M0eutl7zo2Mcq9f+w7BS70tD1g6d6NFREWi1bgae6eQXxI6fQI6TekXaBUifMfnUknAzxCQ=="
```

#### 3. **Implement Real Greenlight Calls**

Replace mock responses in each API route with actual Greenlight SDK calls:

**Example for `/api/lightning/init/route.ts`:**
```typescript
import { Greenlight } from '@blockstream/greenlight-web';

const gl = new Greenlight({
  cert: Buffer.from(GREENLIGHT_CERT, 'base64'),
  network: 'bitcoin', // or 'testnet'
});

// Initialize node
const node = await gl.register(seed); // seed from mnemonic
const nodeInfo = await node.getInfo();
```

**Example for `/api/lightning/invoice/route.ts`:**
```typescript
const invoice = await node.invoice({
  amount_msat: amountSats * 1000,
  description: description,
  expiry: 900, // 15 minutes
});

return {
  bolt11: invoice.bolt11,
  paymentHash: invoice.payment_hash,
  // ...
};
```

**Example for `/api/lightning/pay/route.ts`:**
```typescript
const payment = await node.pay({
  bolt11: bolt11,
});

return {
  paymentHash: payment.payment_hash,
  amount: payment.amount_msat,
  fee: payment.fee_msat,
  status: 'success',
};
```

#### 4. **Update Dashboard to Use Greenlight**

Add Greenlight initialization when user unlocks wallet:

```typescript
// In Dashboard.tsx or wallet-store.ts
import { greenlightService } from '@/lib/lightning-greenlight-service';

// After wallet unlock:
await greenlightService.initialize(mnemonic);
```

#### 5. **Update QuickPayModal Lightning Flow**

Replace WebLN calls with Greenlight calls:

```typescript
// When creating invoice:
const invoice = await greenlightService.createInvoice(amountSats, description);

// When paying invoice:
const payment = await greenlightService.payInvoice(bolt11);
```

#### 6. **Add Lightning Balance to Dashboard**

Show Lightning balance alongside Bitcoin balance:

```typescript
const lightningBalance = await greenlightService.getBalance();
const balanceInSats = greenlightService.millisatsToSats(lightningBalance.local);
```

### 🎯 Why This Architecture?

**✅ Works on Mobile & Desktop:**
- Frontend service calls backend API
- Backend handles Greenlight gRPC
- No native code needed in browser

**✅ Non-Custodial:**
- User's mnemonic derives Lightning keys
- Greenlight hosts node but user controls keys
- Private, secure, decentralized

**✅ Scalable:**
- Backend can handle multiple users
- Greenlight manages infrastructure
- No need to run own Lightning node

**✅ Fast Development:**
- Mock responses allow testing immediately
- Can swap WebLN → Greenlight gradually
- No breaking changes to UI

### 📝 Implementation Steps (Priority Order):

1. ✅ Frontend service (DONE)
2. ✅ Backend API routes (DONE)
3. ✅ Mock responses for testing (DONE)
4. ⏳ Install Greenlight SDK
5. ⏳ Implement real API calls
6. ⏳ Connect to Dashboard
7. ⏳ Update QuickPayModal
8. ⏳ Add Lightning balance display
9. ⏳ Test on mainnet with small amounts
10. ⏳ Deploy to production

### 🔐 Security Notes:

- **Certificate Storage:** Greenlight cert is stored in env vars (server-side only)
- **Mnemonic Handling:** Never send mnemonic to server, derive seed client-side
- **API Authentication:** Add JWT tokens for API routes (production)
- **Rate Limiting:** Implement rate limits for Lightning API (production)

### 🧪 Testing Strategy:

1. **Mock Testing (Current):** Test UX flow with mock responses
2. **Testnet Testing:** Connect to Greenlight testnet
3. **Mainnet Small Amounts:** Test with 100-1000 sats
4. **Full Production:** Launch with confidence

### 📚 Resources:

- Greenlight Docs: https://sdk-doc-greenlight.breez.technology/
- Greenlight Web SDK: https://github.com/Blockstream/greenlight-web
- BOLT11 Spec: https://github.com/lightning/bolts/blob/master/11-payment-encoding.md
- Breez UX Guidelines: https://sdk-doc-greenlight.breez.technology/guide/ux_guidelines.html

---

## 🎉 Next Steps:

De infrastructuur staat! Nu alleen nog:
1. Install `@blockstream/greenlight-web`
2. Replace mock responses met echte Greenlight calls
3. Test op testnet
4. Deploy! ⚡

**Estimated Time:** 2-3 hours voor volledige implementatie met testing.

