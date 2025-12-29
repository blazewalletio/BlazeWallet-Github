# 🔒 SECURITY FIX PROPOSAL - SMART SCHEDULE

**Datum**: 29 december 2025  
**Status**: ✅ Finaal voorstel - Geen functionaliteit verandert

---

## 📊 OVERZICHT

**Doel**: Fix kritieke en hoge security issues zonder functionaliteit te veranderen

**Aanpak**: 
- Toevoegen van sanitization functies
- Backward compatible changes
- Geen breaking changes
- Alle functionaliteit blijft werken

---

## 🎯 FIXES TE IMPLEMENTEREN

### **1. LOGGING SANITIZATION** 🔴 (KRITIEK)

**Probleem**: Logs bevatten sensitive data (addresses, amounts)

**Oplossing**: 
- Extend `lib/logger.ts` met sanitization functies
- Automatisch sanitize addresses en amounts in production
- Development mode: volledige logs (voor debugging)
- Production mode: sanitized logs (voor privacy)

**Implementatie**:
```typescript
// lib/logger.ts - Nieuwe functies toevoegen
export const secureLogger = {
  // Hash address (laatste 4 chars)
  hashAddress: (address: string): string => {
    if (isDevelopment) return address; // Full in dev
    if (!address || address.length < 8) return '***';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  },
  
  // Mask amount (bijv. "1.5 USDT" → "~1-2 USDT")
  maskAmount: (amount: string, symbol?: string): string => {
    if (isDevelopment) return `${amount} ${symbol || ''}`;
    const num = parseFloat(amount);
    if (num < 1) return `<1 ${symbol || ''}`;
    if (num < 10) return `~1-10 ${symbol || ''}`;
    const rounded = Math.round(num / 10) * 10;
    return `~${rounded}-${rounded + 10} ${symbol || ''}`;
  },
  
  // Log transaction (sanitized)
  transaction: (tx: any) => {
    logger.log(`   Chain: ${tx.chain}`);
    logger.log(`   Amount: ${maskAmount(tx.amount, tx.token_symbol)}`);
    logger.log(`   To: ${hashAddress(tx.to_address)}`);
  }
};
```

**Impact**: 
- ✅ Geen functionaliteit verandert
- ✅ Alleen logging output verandert
- ✅ Development mode blijft volledig
- ✅ Production mode is privacy-safe

**Files te wijzigen**:
- `lib/logger.ts` - Add sanitization functies
- `app/api/cron/execute-scheduled-txs/route.ts` - Use secureLogger
- `lib/blockchair-service.ts` - Use secureLogger
- `lib/transaction-executor.ts` - Use secureLogger

---

### **2. CRON SECRET IN URL** 🟡 (HOOG)

**Probleem**: CRON_SECRET in URL query parameters kan worden gelekt

**Oplossing**: 
- **FASE 1**: Keep URL support (voor EasyCron backward compatibility)
- **FASE 2**: Add deprecation warning in logs
- **FASE 3**: Document migration naar Authorization header
- **FASE 4**: (Later) Remove URL support na EasyCron update

**Implementatie**:
```typescript
// app/api/cron/execute-scheduled-txs/route.ts

// Keep URL support for now (EasyCron compatibility)
const cronSecret = req.url.includes('CRON_SECRET=') ? 
  new URL(req.url).searchParams.get('CRON_SECRET') : null;

// ⚠️ DEPRECATED: Log warning if URL secret is used
if (cronSecret) {
  logger.warn('⚠️ [SECURITY] CRON_SECRET in URL is deprecated. Use Authorization header instead.');
}

// Prefer Authorization header
const authHeader = req.headers.get('authorization');
const isAuthorized = authHeader === `Bearer ${CRON_SECRET}` || cronSecret === CRON_SECRET;
```

**EasyCron Update**:
- EasyCron ondersteunt Authorization headers
- Update EasyCron config: Use "Authorization: Bearer {CRON_SECRET}" header
- Keep URL as fallback voor backward compatibility

**Impact**:
- ✅ Geen breaking changes
- ✅ Backward compatible
- ✅ EasyCron kan worden geupdate zonder downtime
- ⚠️ Deprecation warning in logs

**Files te wijzigen**:
- `app/api/cron/execute-scheduled-txs/route.ts` - Add deprecation warning
- `EASYCRON_SETUP_INSTRUCTIES.md` - Update met Authorization header instructies

---

### **3. RATE LIMITING** 🟡 (HOOG)

**Probleem**: Geen rate limiting op smart scheduler endpoints

**Oplossing**: 
- Simple in-memory rate limiter (per IP)
- Per-user rate limiting (via user_id)
- Max requests per tijdseenheid
- Fail-open (als rate limit faalt, allow request)

**Implementatie**:
```typescript
// lib/rate-limit-service.ts (bestaat al, extenden)

// Simple in-memory rate limiter voor API endpoints
class APIRateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  check(identifier: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const key = identifier;
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside window
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return false; // Rate limited
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    
    return true; // Allowed
  }
}

// Usage in API routes
const rateLimiter = new APIRateLimiter();
const identifier = req.headers.get('x-forwarded-for') || 'unknown';
if (!rateLimiter.check(identifier, 10, 60000)) { // 10 requests per minute
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
}
```

**Impact**:
- ✅ Geen functionaliteit verandert
- ✅ Alleen extra check toegevoegd
- ✅ Fail-open (geen impact als rate limiter faalt)
- ✅ Beschermt tegen DoS

**Files te wijzigen**:
- `lib/rate-limit-service.ts` - Extend met API rate limiter
- `app/api/smart-scheduler/create/route.ts` - Add rate limiting
- `app/api/cron/execute-scheduled-txs/route.ts` - Add rate limiting (per IP)

---

### **4. ERROR MESSAGE SANITIZATION** 🟠 (MEDIUM)

**Probleem**: Error messages kunnen stack traces bevatten

**Oplossing**:
- Generic error messages in production
- Detailed errors alleen in development
- Sanitize error responses

**Implementatie**:
```typescript
// lib/error-handler.ts (nieuw bestand)

export function sanitizeError(error: any, isDevelopment: boolean): {
  message: string;
  details?: any;
} {
  if (isDevelopment) {
    return {
      message: error.message || 'Unknown error',
      details: error
    };
  }
  
  // Production: Generic messages
  if (error.message?.includes('database')) {
    return { message: 'Database error occurred' };
  }
  if (error.message?.includes('network')) {
    return { message: 'Network error occurred' };
  }
  if (error.message?.includes('decrypt')) {
    return { message: 'Decryption error occurred' };
  }
  
  return { message: 'An error occurred' };
}
```

**Impact**:
- ✅ Geen functionaliteit verandert
- ✅ Alleen error messages verandert
- ✅ Development mode blijft volledig
- ✅ Production mode is secure

**Files te wijzigen**:
- `lib/error-handler.ts` - Nieuw bestand
- `app/api/smart-scheduler/create/route.ts` - Use sanitizeError
- `app/api/cron/execute-scheduled-txs/route.ts` - Use sanitizeError

---

### **5. ENVIRONMENT VARIABLE BEVEILIGING** 🔴 (KRITIEK - COMPLEX)

**Probleem**: Single master key voor alle transactions

**Oplossing**: 
- **FASE 1**: Document key rotation process
- **FASE 2**: Add key versioning support (voor toekomst)
- **FASE 3**: (Later) Implement key rotation

**Implementatie** (FASE 1 - Documentatie):
```typescript
// lib/scheduled-tx-crypto.ts - Add comments

/**
 * 🔐 SCHEDULED_TX_ENCRYPTION_KEY
 * 
 * SECURITY NOTES:
 * - This is a master key for ALL scheduled transactions
 * - If leaked, ALL transactions can be decrypted
 * - Key rotation requires re-encrypting all pending transactions
 * 
 * KEY ROTATION PROCESS (Manual):
 * 1. Generate new key: openssl rand -base64 32
 * 2. Update Vercel env var: SCHEDULED_TX_ENCRYPTION_KEY
 * 3. Re-encrypt all pending transactions (migration script)
 * 4. Update old transactions to use new key version
 * 
 * FUTURE: Implement automatic key rotation
 */
```

**Impact**:
- ✅ Geen functionaliteit verandert
- ✅ Alleen documentatie toegevoegd
- ✅ Key rotation process gedocumenteerd
- ⚠️ Key rotation moet handmatig (voor nu)

**Files te wijzigen**:
- `lib/scheduled-tx-crypto.ts` - Add security comments
- `SECURITY_KEY_ROTATION_GUIDE.md` - Nieuw document

---

## 📋 IMPLEMENTATIE PLAN

### **STAP 1: Logging Sanitization** (Kritiek)
1. Extend `lib/logger.ts` met sanitization functies
2. Update alle logging calls in smart scheduler
3. Test: Development logs volledig, production logs sanitized

### **STAP 2: Cron Secret Deprecation** (Hoog)
1. Add deprecation warning in logs
2. Update EasyCron documentatie
3. Test: Both URL en Authorization header werken

### **STAP 3: Rate Limiting** (Hoog)
1. Extend rate limit service
2. Add rate limiting aan API endpoints
3. Test: Rate limiting werkt, fail-open bij errors

### **STAP 4: Error Sanitization** (Medium)
1. Create error handler utility
2. Update error responses
3. Test: Development errors volledig, production errors generic

### **STAP 5: Key Rotation Documentation** (Kritiek - Documentatie)
1. Add security comments
2. Create key rotation guide
3. Test: Documentatie is compleet

---

## ✅ BACKWARD COMPATIBILITY

**Alle fixes zijn backward compatible**:
- ✅ EasyCron URL secret blijft werken (met warning)
- ✅ Development mode blijft volledig functioneel
- ✅ Geen breaking changes
- ✅ Alle functionaliteit blijft werken

---

## 🧪 TESTING PLAN

**Voor elke fix**:
1. Test in development mode (volledige functionaliteit)
2. Test in production mode (sanitized output)
3. Test backward compatibility
4. Test error handling
5. Verify geen functionaliteit is gebroken

---

## 📊 RISICO ASSESSMENT

**Risico van implementatie**: **LAAG**
- Alleen logging/error messages verandert
- Geen core functionaliteit aangepast
- Backward compatible
- Fail-open rate limiting

**Risico van NIET implementeren**: **HOOG**
- Privacy leaks via logs
- Secret leaks via URL
- DoS mogelijk
- Information disclosure

---

## 🎯 CONCLUSIE

**Alle fixes kunnen worden geïmplementeerd zonder functionaliteit te veranderen**:
- ✅ Logging: Sanitization functies toevoegen
- ✅ Cron Secret: Deprecation warning + documentatie
- ✅ Rate Limiting: Fail-open rate limiter
- ✅ Error Messages: Conditional sanitization
- ✅ Key Rotation: Documentatie (implementatie later)

**Ready to implement?** ✅ Ja, alle fixes zijn safe en backward compatible.

---

**Laatste update**: 29 december 2025, 14:00 UTC  
**Status**: Finaal voorstel compleet - Klaar voor implementatie

