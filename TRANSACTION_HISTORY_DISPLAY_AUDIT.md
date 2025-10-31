# 🔍 TRANSACTION HISTORY DISPLAY AUDIT
**Date:** 31 Oktober 2025  
**Focus:** Logo's en muntnamen in History tab  

---

## 📊 CURRENT STATUS

### **✅ WORKING PERFECT:**

**Solana (Native + SPL):**
```typescript
// lib/solana-service.ts:297-310
return {
  hash: sig.signature,
  from: txDetails.from,
  to: txDetails.to,
  value: txDetails.value,
  timestamp,
  isError: tx.meta?.err !== null,
  tokenSymbol: txDetails.tokenSymbol,  // ✅ Has symbol
  tokenName: txDetails.tokenName,      // ✅ Has name
  mint: txDetails.mint,                // ✅ Has mint
  logoUrl: txDetails.logoUrl,          // ✅ Has logo
};
```

**Result:** ✅ SPL tokens show correct name + logo in history!

---

**EVM Chains (Ethereum, Polygon, etc.) via Alchemy:**
```typescript
// lib/alchemy-service.ts (getFullTransactionHistory)
// Returns tokenSymbol, tokenName, logoUrl for ERC20 transfers
```

**Result:** ✅ ERC20 tokens show correct name + logo in history!

---

### **❌ BROKEN:**

**Bitcoin:**
```typescript
// lib/bitcoin-service.ts:474-486
transactions.push({
  hash: tx.txid,
  from: [...],
  to: [...],
  value: Math.abs(value),
  valueBTC: (Math.abs(value) / 100000000).toFixed(8),
  fee: tx.fee || 0,
  timestamp: tx.status?.block_time ? tx.status.block_time * 1000 : Date.now(),
  confirmations: tx.status?.confirmed ? 1 : 0,
  isError: false,
  blockNumber: tx.status?.block_height,
  type,
  // ❌ NO tokenName
  // ❌ NO tokenSymbol
  // ❌ NO logoUrl
});
```

**Result:** ❌ Bitcoin shows "Sent/Received" instead of "Bitcoin" + no BTC logo watermark!

---

**Litecoin:**
```typescript
// lib/bitcoin-fork-service.ts:463-476
transactions.push({
  hash: tx.hash,
  from: tx.inputs.flatMap((input: any) => input.addresses || []),
  to: tx.outputs.flatMap((output: any) => output.addresses || []),
  value,
  valueNative: (value / 1e8).toFixed(8),
  fee: tx.fees || 0,
  timestamp: new Date(tx.received).getTime() / 1000,
  confirmations: tx.confirmations || 0,
  isError: false,
  blockNumber: tx.block_height,
  type: isSent ? 'send' : 'receive',
  // ❌ NO tokenName
  // ❌ NO tokenSymbol
  // ❌ NO logoUrl
});
```

**Result:** ❌ Litecoin shows "Sent/Received" instead of "Litecoin" + no LTC logo!

---

**Same issue for:**
- ❌ Dogecoin
- ❌ Bitcoin Cash

---

## 🎯 FIX REQUIRED

Add `tokenName`, `tokenSymbol`, and `logoUrl` to transaction history for:
1. Bitcoin (BTC)
2. Litecoin (LTC)
3. Dogecoin (DOGE)
4. Bitcoin Cash (BCH)

---

## 💡 SOLUTION

For UTXO-based chains (Bitcoin, Litecoin, Dogecoin, Bitcoin Cash), we need to add native currency metadata to transaction history responses.

### **Fix 1: Bitcoin Service**
File: `lib/bitcoin-service.ts`

```typescript
transactions.push({
  hash: tx.txid,
  from: tx.vin.map((vin: any) => vin.prevout?.scriptpubkey_address || 'Unknown').filter(Boolean),
  to: tx.vout.map((vout: any) => vout.scriptpubkey_address).filter(Boolean),
  value: Math.abs(value),
  valueBTC: (Math.abs(value) / 100000000).toFixed(8),
  fee: tx.fee || 0,
  timestamp: tx.status?.block_time ? tx.status.block_time * 1000 : Date.now(),
  confirmations: tx.status?.confirmed ? 1 : 0,
  isError: false,
  blockNumber: tx.status?.block_height,
  type,
  // ✅ ADD THESE:
  tokenName: 'Bitcoin',
  tokenSymbol: 'BTC',
  logoUrl: '/crypto-bitcoin.png',
});
```

---

### **Fix 2: Bitcoin Fork Service**
File: `lib/bitcoin-fork-service.ts`

```typescript
// Get chain config for metadata
const chainConfig = CHAINS[this.chainKey];

transactions.push({
  hash: tx.hash,
  from: tx.inputs.flatMap((input: any) => input.addresses || []),
  to: tx.outputs.flatMap((output: any) => output.addresses || []),
  value,
  valueNative: (value / 1e8).toFixed(8),
  fee: tx.fees || 0,
  timestamp: new Date(tx.received).getTime() / 1000,
  confirmations: tx.confirmations || 0,
  isError: false,
  blockNumber: tx.block_height,
  type: isSent ? 'send' : 'receive',
  // ✅ ADD THESE:
  tokenName: chainConfig.nativeCurrency.name,    // "Litecoin" / "Dogecoin" / "Bitcoin Cash"
  tokenSymbol: chainConfig.nativeCurrency.symbol, // "LTC" / "DOGE" / "BCH"
  logoUrl: chainConfig.logoUrl,                   // "/crypto-litecoin.png" etc.
});
```

---

## 📋 EXPECTED RESULT AFTER FIX

### **Bitcoin Transaction:**
```
┌─────────────────────────────────────────┐
│ 🟧 Bitcoin                          ✓  │  ← Shows "Bitcoin" not "Sent"
│    bc1q...xyz                           │
│    2h geleden                           │
│                    -0.001000 BTC     ⟶ │
└─────────────────────────────────────────┘
   (with BTC logo watermark) 👻
```

### **Litecoin Transaction:**
```
┌─────────────────────────────────────────┐
│ 🟦 Litecoin                         ✓  │  ← Shows "Litecoin" not "Sent"
│    L...abc                              │
│    5m geleden                           │
│                    -0.100000 LTC     ⟶ │
└─────────────────────────────────────────┘
   (with LTC logo watermark) 👻
```

---

## 🚀 IMPLEMENTATION PRIORITY

**Priority:** 🔴 HIGH (improves UX significantly)
**Time:** 15 minutes
**Impact:** All Bitcoin-fork chain transactions will show proper names + logos

---

**Ready to implement!** ✅

