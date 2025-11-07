# 🚨 CRITICAL: SCHEDULED TRANSACTION AUTHENTICATION ANALYSIS

**Datum:** 6 november 2025  
**Status:** 🔴 **NIET WERKEND** - Critical security/functionality gap  
**Priority:** P0 - BLOCKER

---

## 🔍 PROBLEEM ANALYSE

### **WAT JE ZEI IS 100% CORRECT:**

> "Er wordt geen authenticatie meegezonden bij het inplannen, en de cron job kan transacties niet uitvoeren zonder private key"

### **HUIDIGE SITUATIE:**

#### **1. Bij het INPLANNEN (create route):**
```typescript
// app/api/smart-scheduler/create/route.ts
await supabase.from('scheduled_transactions').insert({
  user_id: body.user_id,
  from_address: body.from_address,  // ✅ Adres wordt opgeslagen
  to_address: body.to_address,
  amount: body.amount,
  // ❌ GEEN private key
  // ❌ GEEN signed transaction
  // ❌ GEEN authenticatie materiaal
});
```

#### **2. Bij het UITVOEREN (cron job):**
```typescript
// lib/transaction-executor.ts - Line 303
async function getPrivateKey(address: string): Promise<string | null> {
  console.warn('⚠️  Private key retrieval not yet implemented');
  return null; // ❌ ALTIJD NULL!
}
```

**RESULTAAT:** 
- Transacties worden NOOIT uitgevoerd
- `getPrivateKey()` returnt altijd `null`
- Cron job markeert transacties als "failed"

---

## 🛡️ SECURITY & ARCHITECTURAL CHALLENGE

### **HET DILEMMA:**

Je wilt dat transacties **AUTOMATISCH** worden uitgevoerd, maar dit vereist:
1. ✅ **Geen handmatige goedkeuring** (user is niet online)
2. ❌ **WEL private key toegang** (om tx te signen)
3. ❌ **WEL security** (keys mogen NOOIT gecompromitteerd worden)

### **WAAROM IS DIT MOEILIJK?**

**Option A: Store Private Key** 🔴 **GEVAARLIJK**
- Private key opslaan in database
- **ENORM SECURITY RISK**: Als database gelekt wordt, zijn alle wallets gehacked
- **NOOIT DOEN** voor een non-custodial wallet

**Option B: Store Signed Transaction** 🟡 **BETER MAAR BEPERKT**
- User signt transaction bij inplannen
- Store signed TX in database
- Cron job broadcast signed TX
- **PROBLEEM**: Gas price/nonce kan veranderen → TX faalt
- **PROBLEEM**: User kan nonce al gebruikt hebben voor andere TX

**Option C: Custodial Sub-Account** 🟠 **COMPLEX MAAR VEILIG**
- User deposited funds naar temporary custodial wallet
- Custodial wallet voert TX uit
- User kan altijd funds terug withdrawen
- **PROBLEEM**: Extra stap voor user, niet echt "non-custodial"

**Option D: Smart Contract Automation** 🟢 **BEST MAAR EVM-ONLY**
- Smart contract met time-lock
- User signt eenmalig approval
- Contract voert TX automatisch uit
- **PROBLEEM**: Alleen voor EVM chains, niet voor Solana/Bitcoin

**Option E: Delegated Signing with HSM** 🟢 **ENTERPRISE MAAR DUUR**
- Hardware Security Module (HSM) beheert keys
- Limited signing permissions
- Revocable access
- **PROBLEEM**: $$$$ kosten, complex setup

---

## ✅ AANBEVOLEN OPLOSSING: **HYBRID APPROACH**

### **"PRE-SIGNED TRANSACTION + DYNAMIC GAS ADJUSTMENT"**

#### **CONCEPT:**
1. User signt transaction **BIJ INPLANNEN**
2. We slaan **GESIGNDE TX** op (niet private key!)
3. Bij uitvoeren: We **BROADCASTEN** de signed TX
4. Als gas price veranderd → We vragen user **OP MOMENT VAN UITVOEREN** om nieuwe signature (push notification)

#### **WHY THIS WORKS:**
- ✅ **GEEN private keys opgeslagen**
- ✅ **User blijft in controle**
- ✅ **Werkt voor alle chains** (EVM, Solana, Bitcoin)
- ✅ **Gas-efficient** (signed TX kan direct broadcast)
- ⚠️ **Trade-off**: Als gas price stijgt, moet user opnieuw signen (acceptable)

---

## 🏗️ IMPLEMENTATION PLAN

### **FASE 1: PRE-SIGNED TRANSACTIONS (EVM CHAINS)**

#### **A. Update Database Schema**
```sql
ALTER TABLE scheduled_transactions 
ADD COLUMN signed_transaction TEXT; -- Stores hex-encoded signed TX
ADD COLUMN signature_expires_at TIMESTAMP; -- TX signature validity
ADD COLUMN needs_re_signature BOOLEAN DEFAULT FALSE;
```

#### **B. Update CREATE API**
```typescript
// app/api/smart-scheduler/create/route.ts

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  // NEW: Require signed transaction
  if (!body.signed_transaction) {
    return NextResponse.json(
      { error: 'Signed transaction required' },
      { status: 400 }
    );
  }
  
  // Validate signed transaction
  const isValid = await validateSignedTransaction(
    body.signed_transaction,
    body.from_address,
    body.to_address,
    body.amount
  );
  
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid signed transaction' },
      { status: 400 }
    );
  }
  
  // Store signed transaction
  await supabase.from('scheduled_transactions').insert({
    ...body,
    signed_transaction: body.signed_transaction, // ✅ Store signed TX
    signature_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h validity
  });
}
```

#### **C. Update Frontend (SendModal)**
```typescript
// components/SendModal.tsx

async function handleScheduleTransaction() {
  // 1. Build transaction
  const tx = await buildTransaction({
    to: recipientAddress,
    value: amount,
    gasPrice: currentGasPrice, // User sees current gas price
  });
  
  // 2. Ask user to SIGN (using wallet provider)
  const signedTx = await wallet.signTransaction(tx);
  
  // 3. Send to backend
  await fetch('/api/smart-scheduler/create', {
    method: 'POST',
    body: JSON.stringify({
      signed_transaction: signedTx, // ✅ Signed TX
      from_address: wallet.address,
      to_address: recipientAddress,
      amount: amount,
      // ... other fields
    }),
  });
  
  // 4. Show confirmation
  alert('Transaction scheduled! It will execute at optimal gas price.');
}
```

#### **D. Update EXECUTE API**
```typescript
// app/api/cron/execute-scheduled-txs/route.ts

async function executeTransaction(tx: any) {
  // Get signed transaction from database
  const signedTx = tx.signed_transaction;
  
  if (!signedTx) {
    throw new Error('No signed transaction found');
  }
  
  // Check if signature is still valid
  if (new Date() > new Date(tx.signature_expires_at)) {
    // Mark as needs re-signature
    await supabase
      .from('scheduled_transactions')
      .update({ needs_re_signature: true })
      .eq('id', tx.id);
    
    // Send push notification to user
    await sendPushNotification(tx.user_id, {
      title: 'Re-sign Required',
      message: 'Gas prices changed. Please re-sign your scheduled transaction.',
      action: `/scheduled-transactions/${tx.id}/re-sign`,
    });
    
    return { success: false, error: 'Signature expired' };
  }
  
  // Broadcast signed transaction
  const provider = new ethers.JsonRpcProvider(getRPCUrl(tx.chain));
  const txResponse = await provider.broadcastTransaction(signedTx);
  const receipt = await txResponse.wait();
  
  return {
    success: true,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}
```

---

### **FASE 2: DYNAMIC GAS ADJUSTMENT (OPTIONAL)**

Voor betere UX: Sta toe dat gas price fluctueert binnen een range:

```typescript
// Bij inplannen:
const tx = await buildTransaction({
  to: recipientAddress,
  value: amount,
  maxFeePerGas: ethers.parseUnits('100', 'gwei'), // Max user wil betalen
  maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
});

// Bij uitvoeren:
// Gebruik EIP-1559 dynamic fees → Signed TX blijft geldig!
```

---

### **FASE 3: MULTI-CHAIN SUPPORT**

#### **SOLANA:**
```typescript
// Solana signed transactions zijn simpeler
const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: fromAddress,
    toPubkey: toAddress,
    lamports: amount,
  })
);

// User signt
await wallet.signTransaction(transaction);

// Store serialized transaction
const serializedTx = transaction.serialize();
const base64Tx = Buffer.from(serializedTx).toString('base64');

// Later: broadcast
const connection = new Connection(SOLANA_RPC);
const signature = await connection.sendRawTransaction(serializedTx);
```

#### **BITCOIN:**
```typescript
// Bitcoin: PSBT (Partially Signed Bitcoin Transaction)
const psbt = new bitcoin.Psbt();
psbt.addInput({ ... });
psbt.addOutput({ ... });

// User signt
await wallet.signPsbt(psbt);

// Store signed PSBT
const signedPsbt = psbt.toBase64();

// Later: broadcast
const finalizedTx = psbt.finalizeAllInputs().extractTransaction();
await broadcastBitcoinTx(finalizedTx.toHex());
```

---

## 📊 COMPARISON TABLE

| Approach | Security | UX | Complexity | Multi-Chain | Recommendation |
|----------|----------|-----|------------|-------------|----------------|
| **Store Private Key** | 🔴 0/10 | 🟢 10/10 | 🟢 2/10 | ✅ Yes | ❌ NEVER |
| **Pre-Signed TX** | 🟢 9/10 | 🟡 7/10 | 🟡 5/10 | ✅ Yes | ✅ **BEST** |
| **Custodial Sub-Account** | 🟡 6/10 | 🟢 8/10 | 🔴 8/10 | ✅ Yes | ⚠️ OK |
| **Smart Contract** | 🟢 10/10 | 🟢 9/10 | 🟡 6/10 | ❌ EVM only | ⚠️ Limited |
| **HSM** | 🟢 10/10 | 🟢 9/10 | 🔴 9/10 | ✅ Yes | 💰 $$$$ |

---

## 🎯 RECOMMENDED SOLUTION: **PRE-SIGNED TX**

### **WHY?**
1. ✅ **Security**: Private keys NEVER leave user's device
2. ✅ **Multi-chain**: Works for EVM, Solana, Bitcoin
3. ✅ **UX**: User signs once, execution is automatic
4. ✅ **Cost**: $0 extra infrastructure
5. ✅ **Non-custodial**: User blijft in controle

### **TRADE-OFFS:**
- ⚠️ Als gas price stijgt boven user's max → Moet opnieuw signen
- ⚠️ Als nonce verandert → TX faalt (rare edge case)

### **MITIGATION:**
- Use EIP-1559 (dynamic fees) voor EVM
- Set ruime max gas price (bijv. 2x current)
- Signature validity: 24-48 uur

---

## 🚀 IMPLEMENTATION TIMELINE

### **Week 1: EVM Chains (Ethereum, Polygon, etc.)**
- Day 1-2: Database schema update
- Day 3-4: Frontend signing flow
- Day 5-7: Cron job broadcasting

### **Week 2: Solana**
- Day 1-3: Solana serialized transaction support
- Day 4-5: Testing + edge cases

### **Week 3: Bitcoin & Testing**
- Day 1-4: Bitcoin PSBT implementation
- Day 5-7: End-to-end testing all chains

### **Week 4: Polish & Monitoring**
- Monitoring/alerting
- Re-signing flow UX
- Documentation

---

## 💡 ALTERNATIVE: QUICK WIN FOR MVP

Als je **NU** wilt testen zonder volledige implementation:

### **OPTION: MANUAL EXECUTION BUTTON**

```typescript
// Show "Execute Now" button in Scheduled Transactions list
<button onClick={() => executeTransactionManually(tx.id)}>
  Execute Now (Manual)
</button>

// Frontend signt + broadcast direct
async function executeTransactionManually(txId: string) {
  const tx = await fetchScheduledTransaction(txId);
  
  // Build transaction
  const unsignedTx = buildTransaction(tx);
  
  // Ask user to sign NOW
  const signedTx = await wallet.signTransaction(unsignedTx);
  
  // Broadcast
  const receipt = await provider.sendTransaction(signedTx);
  
  // Update database
  await markTransactionCompleted(txId, receipt.hash);
}
```

**Voordeel:** Werkt NU al, geen cron job nodig  
**Nadeel:** Niet echt "automated" - user moet online zijn

---

## ✅ CONCLUSIE

1. **Huidige implementatie werkt NIET** omdat `getPrivateKey()` altijd `null` returnt
2. **Aanbevolen oplossing**: Pre-signed transactions
3. **Security**: Private keys blijven veilig op user device
4. **Timeline**: 3-4 weken voor volledige implementation
5. **Quick win**: Manual execution button voor MVP testing

**Wil je dat ik de pre-signed transaction flow implementeer?**

