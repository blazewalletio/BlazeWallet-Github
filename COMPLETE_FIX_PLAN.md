# 🔧 BLAZE WALLET - COMPLETE FIX PLAN

**Datum:** 13 november 2025  
**Alle 35 Issues - Punt-voor-Punt Verbeterplan**

---

## 🔴 CRITICAL ISSUES

### CRITICAL-1: CORS Wildcard Security Vulnerability

**Probleem:**
`/api/transactions/route.ts` gebruikt `Access-Control-Allow-Origin: '*'` wat betekent dat ELKE website jullie API kan aanroepen.

**Locatie:**
- `app/api/transactions/route.ts:128`

**Impact:**
- Severity: CRITICAL
- Elke malicious website kan transactions fetchen
- Wallet addresses kunnen worden ge-enumerate
- User privacy wordt geschonden
- API misbruik mogelijk

**Oplossing:**

**Stap 1:** Maak whitelist van allowed origins
```typescript
// app/api/transactions/route.ts (regel 127-135)

// TE VERVANGEN:
return NextResponse.json(data, {
  headers: {
    'Access-Control-Allow-Origin': '*',  // ❌ VERWIJDER DIT
  },
});

// NIEUWE CODE:
const origin = request.headers.get('origin');
const allowedOrigins = [
  'https://blazewallet.io',
  'https://my.blazewallet.io',
  'http://localhost:3000',
  'http://localhost:3001', // Voor development
];

// Allow Vercel preview deployments (specifiek patroon)
const isVercelPreview = origin?.match(
  /^https:\/\/blaze-wallet-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/
);

let corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
};

if (origin && (allowedOrigins.includes(origin) || isVercelPreview)) {
  corsHeaders['Access-Control-Allow-Origin'] = origin;
  corsHeaders['Vary'] = 'Origin'; // Important for CDN caching
}

return NextResponse.json(data, { headers: corsHeaders });
```

**Stap 2:** Update OPTIONS handler
```typescript
// app/api/transactions/route.ts (regel 149-156)

// TE VERVANGEN:
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',  // ❌ VERWIJDER DIT
    },
  });
}

// NIEUWE CODE:
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://blazewallet.io',
    'https://my.blazewallet.io',
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  
  const isVercelPreview = origin?.match(
    /^https:\/\/blaze-wallet-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/
  );
  
  let corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours preflight cache
  };
  
  if (origin && (allowedOrigins.includes(origin) || isVercelPreview)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    corsHeaders['Vary'] = 'Origin';
  }
  
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
```

**Stap 3:** Check ALLE andere API routes
```bash
# Te checken bestanden:
app/api/prices/route.ts
app/api/ai-assistant/route.ts
app/api/smart-scheduler/*/route.ts
# En alle andere API endpoints
```

**Benodigde Bestanden:**
- ✏️ `app/api/transactions/route.ts`
- 🔍 Audit alle bestanden in `app/api/`

**Tijdsinschatting:** 1-2 uur (incl. testing alle endpoints)

**Testing:**
```bash
# Test 1: Van allowed origin
curl -H "Origin: https://blazewallet.io" \
  https://your-app.vercel.app/api/transactions?chainId=1&address=0x...

# Expected: CORS headers present

# Test 2: Van disallowed origin
curl -H "Origin: https://evil.com" \
  https://your-app.vercel.app/api/transactions?chainId=1&address=0x...

# Expected: NO Access-Control-Allow-Origin header

# Test 3: Zonder origin (direct browser)
curl https://your-app.vercel.app/api/transactions?chainId=1&address=0x...

# Expected: Works, no CORS headers (same-origin)
```

**Verificatie Checklist:**
- [ ] CORS headers alleen voor allowed origins
- [ ] Vercel preview URLs werken
- [ ] Localhost development werkt
- [ ] Evil.com krijgt GEEN CORS headers
- [ ] Browser console heeft geen CORS errors

---

### CRITICAL-2: CSRF Protection Ontbreekt

**Probleem:**
Alle POST/PUT/DELETE endpoints hebben geen CSRF token verificatie, waardoor attackers acties kunnen uitvoeren namens ingelogde users.

**Locaties:**
- `app/api/smart-scheduler/create/route.ts`
- `app/api/smart-scheduler/cancel/route.ts`
- `app/api/referral/claim/route.ts`
- `app/api/cashback/claim/route.ts`
- `app/api/priority-list/route.ts`
- En meer...

**Impact:**
- Severity: CRITICAL
- Cross-Site Request Forgery attacks mogelijk
- Attackers kunnen transacties schedulen
- Rewards kunnen worden geclaimd door attackers
- Financial loss mogelijk

**Oplossing:**

**Stap 1:** Creëer CSRF middleware
```typescript
// middleware.ts (nieuw bestand in project root)
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return NextResponse.next();
  }
  
  // Skip CSRF for cron jobs (they use different auth)
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }
  
  // Get CSRF token from cookie
  const csrfCookie = request.cookies.get('csrf_token');
  const csrfHeader = request.headers.get('x-csrf-token');
  
  // Verify CSRF token
  if (!csrfCookie || !csrfHeader || csrfCookie.value !== csrfHeader) {
    console.warn('🚫 CSRF token mismatch:', {
      pathname,
      method: request.method,
      hasCookie: !!csrfCookie,
      hasHeader: !!csrfHeader,
      match: csrfCookie?.value === csrfHeader,
    });
    
    return NextResponse.json(
      { 
        error: 'Invalid CSRF token',
        message: 'Security check failed. Please refresh the page and try again.',
      },
      { status: 403 }
    );
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

**Stap 2:** Creëer CSRF token generator API
```typescript
// app/api/csrf-token/route.ts (nieuw bestand)
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export async function GET(request: NextRequest) {
  // Generate or retrieve CSRF token
  const existingToken = request.cookies.get('csrf_token');
  const token = existingToken?.value || nanoid(32);
  
  const response = NextResponse.json({ token });
  
  // Set CSRF cookie if not exists
  if (!existingToken) {
    response.cookies.set('csrf_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
  }
  
  return response;
}
```

**Stap 3:** Update app layout voor CSRF token fetch
```typescript
// app/layout.tsx
'use client';

import { useEffect } from 'react';

export default function RootLayout({ children }) {
  useEffect(() => {
    // Fetch CSRF token on app load
    fetch('/api/csrf-token')
      .then(res => res.json())
      .then(data => {
        // Token is automatically set in cookie by API
        console.log('✅ CSRF token initialized');
      })
      .catch(err => {
        console.error('❌ Failed to initialize CSRF token:', err);
      });
  }, []);
  
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

**Stap 4:** Creëer API client helper
```typescript
// lib/api-client.ts (nieuw bestand)

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

export async function apiPost(url: string, data: any) {
  const csrfToken = getCookie('csrf_token');
  
  if (!csrfToken) {
    console.warn('⚠️ No CSRF token found, fetching...');
    await fetch('/api/csrf-token');
    // Retry after token fetch
    return apiPost(url, data);
  }
  
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(data),
  });
}

export async function apiPut(url: string, data: any) {
  const csrfToken = getCookie('csrf_token');
  
  if (!csrfToken) {
    await fetch('/api/csrf-token');
    return apiPut(url, data);
  }
  
  return fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(data),
  });
}

export async function apiDelete(url: string) {
  const csrfToken = getCookie('csrf_token');
  
  if (!csrfToken) {
    await fetch('/api/csrf-token');
    return apiDelete(url);
  }
  
  return fetch(url, {
    method: 'DELETE',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  });
}
```

**Stap 5:** Update alle POST/PUT/DELETE calls
```typescript
// Voorbeeld: SmartScheduleModal.tsx

// VOOR:
const response = await fetch('/api/smart-scheduler/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(scheduleData),
});

// NA:
import { apiPost } from '@/lib/api-client';

const response = await apiPost('/api/smart-scheduler/create', scheduleData);
```

**Benodigde Bestanden:**
- 🆕 `middleware.ts` (nieuw)
- 🆕 `app/api/csrf-token/route.ts` (nieuw)
- 🆕 `lib/api-client.ts` (nieuw)
- ✏️ `app/layout.tsx` (update)
- ✏️ Alle components met POST/PUT/DELETE calls (zoeken met grep)

**Tijdsinschatting:** 3-4 uur

**Testing:**
```bash
# Test 1: POST zonder CSRF token
curl -X POST https://your-app.vercel.app/api/smart-scheduler/create \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Expected: 403 Invalid CSRF token

# Test 2: POST met correct CSRF token
curl -X POST https://your-app.vercel.app/api/smart-scheduler/create \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token-from-cookie>" \
  -b "csrf_token=<token>" \
  -d '{"test": "data"}'

# Expected: 200 OK (of andere valid response)

# Test 3: In browser console
fetch('/api/smart-scheduler/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({test: 'data'}),
})

# Expected: 403 (geen CSRF header)

# Test 4: Met apiPost helper
import { apiPost } from '@/lib/api-client';
await apiPost('/api/smart-scheduler/create', {test: 'data'});

# Expected: Works!
```

**Verificatie Checklist:**
- [ ] Middleware reject requests zonder CSRF token
- [ ] CSRF token wordt automatisch gefetched
- [ ] apiPost/apiPut/apiDelete helpers werken
- [ ] Alle POST/PUT/DELETE calls gebruiken helpers
- [ ] Browser geen 403 errors na implementatie
- [ ] Cron jobs nog steeds werkend (skip CSRF)

---

### CRITICAL-3: Content Security Policy Te Permissief

**Probleem:**
`next.config.mjs` gebruikt `unsafe-eval` en `unsafe-inline` wat XSS attacks mogelijk maakt.

**Locatie:**
- `next.config.mjs:14`

**Impact:**
- Severity: CRITICAL
- XSS attacks mogelijk via inline scripts
- Code injection via eval()
- Third-party scripts kunnen worden geïnjecteerd
- Wallet stealing mogelijk

**Oplossing:**

**Stap 1:** Implement nonce-based CSP

```typescript
// middleware.ts (update bestaande file)
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(nanoid()).toString('base64');
  
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' https://vercel.live;
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data: https:;
    font-src 'self';
    connect-src 'self' https://ldehmephukevxumwdbwt.supabase.co https://api.openai.com https://api.coingecko.com https://*.etherscan.io https://*.bscscan.com https://*.polygonscan.com https://*.arbiscan.io https://*.optimistic.etherscan.io https://*.basescan.org https://*.snowtrace.io https://*.ftmscan.com https://*.cronoscan.com https://*.lineascan.build https://*.blockchair.com https://global.transak.com https://*.alchemy.com https://*.infura.io https://*.quicknode.pro https://api.dexscreener.com https://price.jup.ag https://api.binance.com wss://ldehmephukevxumwdbwt.supabase.co;
    frame-src https://global.transak.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();
  
  const response = NextResponse.next();
  
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Nonce', nonce);
  
  return response;
}
```

**Stap 2:** Update next.config.mjs
```javascript
// next.config.mjs

// TE VERWIJDEREN: (regel 12-58 - hele headers() functie)
async headers() {
  // ... oude CSP implementatie
}

// NIEUWE CODE: Geen headers() functie nodig - middleware doet dit nu!
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  excludeDefaultMomentLocales: true,
  
  webpack: (config, { isServer }) => {
    // ... bestaande webpack config blijft
    return config;
  },
};

export default nextConfig;
```

**Stap 3:** Update app/layout.tsx voor nonce support
```typescript
// app/layout.tsx
import { headers } from 'next/headers';

export default function RootLayout({ children }) {
  // Get nonce from headers (server component)
  const headersList = headers();
  const nonce = headersList.get('x-nonce');
  
  return (
    <html lang="en">
      <head>
        {/* Inline styles met nonce */}
        <style nonce={nonce}>
          {/* Critical CSS here */}
        </style>
      </head>
      <body>
        {children}
        
        {/* Inline scripts met nonce (als nodig) */}
        <script nonce={nonce}>
          {/* Critical JS here */}
        </script>
      </body>
    </html>
  );
}
```

**Stap 4:** Verplaats inline styles naar CSS modules

```bash
# Zoek alle inline styles:
grep -r "style={{" components/ --include="*.tsx"

# Voor elk gevonden bestand:
# VOOR:
<div style={{ background: 'red' }}>

# NA:
// styles/Component.module.css
.container {
  background: red;
}

// Component.tsx
import styles from './Component.module.css';
<div className={styles.container}>
```

**Stap 5:** Verwijder inline event handlers

```bash
# Zoek alle inline handlers:
grep -r "onClick={() =>" components/ --include="*.tsx"

# VOOR:
<button onClick={() => setCount(count + 1)}>

# NA:
const handleClick = () => setCount(count + 1);
<button onClick={handleClick}>
```

**Benodigde Bestanden:**
- ✏️ `middleware.ts` (update)
- ✏️ `next.config.mjs` (simplify)
- ✏️ `app/layout.tsx` (add nonce support)
- 🆕 CSS modules voor alle components met inline styles
- ✏️ Alle components met inline styles/handlers

**Tijdsinschatting:** 4-6 uur (veel refactoring)

**Testing:**
```bash
# Test 1: Check CSP headers
curl -I https://your-app.vercel.app

# Expected: Content-Security-Policy header zonder unsafe-eval/unsafe-inline

# Test 2: Browser console
# Open DevTools → Console
# Expected: Geen CSP violations

# Test 3: Try inline script attack
# In browser console:
eval('alert("XSS")')

# Expected: Blocked by CSP

# Test 4: Framer Motion animaties
# Check of alle animaties nog werken
# Expected: Alles werkt (Framer gebruikt geen eval)
```

**Verificatie Checklist:**
- [ ] Geen `unsafe-eval` in CSP
- [ ] Geen `unsafe-inline` in CSP
- [ ] Nonces worden correct gegenereerd
- [ ] Alle inline styles verplaatst naar CSS modules
- [ ] Alle animaties nog werkend
- [ ] Geen CSP violations in console
- [ ] Transak iframe nog werkend

---

## 🔴 HIGH PRIORITY ISSUES

### HIGH-1: Production Console Logging (670+ statements)

**Probleem:**
Er staan 670+ console.log/error statements in de code die in production nog steeds actief zijn.

**Locaties:**
- `components/`: 342 statements
- `lib/`: 250+ statements
- `app/api/`: 80+ statements

**Impact:**
- Severity: HIGH
- Performance degradation (I/O operations)
- Gevoelige data exposure (adressen, user IDs)
- Console clutter
- Debugging info voor eindgebruikers

**Oplossing:**

**Stap 1:** Creëer production-safe logger
```typescript
// lib/logger.ts (nieuw bestand)

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LogMeta {
  [key: string]: any;
}

class Logger {
  private isDevelopment: boolean;
  
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }
  
  /**
   * General logging (development only)
   */
  log(message: string, meta?: LogMeta) {
    if (this.isDevelopment) {
      console.log(`[LOG] ${message}`, meta || '');
    }
  }
  
  /**
   * Info logging (development only)
   */
  info(message: string, meta?: LogMeta) {
    if (this.isDevelopment) {
      console.info(`ℹ️ [INFO] ${message}`, meta || '');
    }
  }
  
  /**
   * Warning logging (always logged, but sanitized in production)
   */
  warn(message: string, meta?: LogMeta) {
    if (this.isDevelopment) {
      console.warn(`⚠️ [WARN] ${message}`, meta || '');
    } else {
      // Production: Log to external service
      console.warn(`⚠️ [WARN] ${message}`);
      // TODO: Send to Sentry/LogRocket
    }
  }
  
  /**
   * Error logging (always logged, sent to monitoring)
   */
  error(message: string, error?: Error, meta?: LogMeta) {
    if (this.isDevelopment) {
      console.error(`❌ [ERROR] ${message}`, error, meta || '');
    } else {
      // Production: Log sanitized version
      console.error(`❌ [ERROR] ${message}`);
      
      // Send to monitoring service
      if (typeof window !== 'undefined' && window.Sentry) {
        window.Sentry.captureException(error || new Error(message), {
          extra: this.sanitizeMeta(meta),
        });
      }
    }
  }
  
  /**
   * Debug logging (development only, verbose)
   */
  debug(message: string, meta?: LogMeta) {
    if (this.isDevelopment) {
      console.debug(`🐛 [DEBUG] ${message}`, meta || '');
    }
  }
  
  /**
   * Sanitize metadata for production logging
   * Remove sensitive fields like addresses, keys, etc.
   */
  private sanitizeMeta(meta?: LogMeta): LogMeta {
    if (!meta) return {};
    
    const sanitized: LogMeta = {};
    const sensitiveKeys = [
      'address',
      'wallet',
      'mnemonic',
      'privateKey',
      'password',
      'email',
      'userId',
      'apiKey',
      'token',
    ];
    
    for (const [key, value] of Object.entries(meta)) {
      // Check if key contains sensitive data
      const isSensitive = sensitiveKeys.some(sk => 
        key.toLowerCase().includes(sk.toLowerCase())
      );
      
      if (isSensitive) {
        // Redact sensitive data
        sanitized[key] = typeof value === 'string' 
          ? `${value.substring(0, 6)}...${value.substring(value.length - 4)}`
          : '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

export const logger = new Logger();

// Convenience exports
export const log = logger.log.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
export const debug = logger.debug.bind(logger);
```

**Stap 2:** Bulk replace in alle bestanden

```bash
# Script om alle console.log te vervangen
# create-replace-script.sh

#!/bin/bash

# Zoek alle .ts en .tsx bestanden
find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" \
  -not -path "*/dist/*" \
  | while read file; do
  
  # Check of bestand console.log bevat
  if grep -q "console\\.log\\|console\\.error\\|console\\.warn\\|console\\.info\\|console\\.debug" "$file"; then
    echo "Processing: $file"
    
    # Backup maken
    cp "$file" "$file.backup"
    
    # Add import if not exists
    if ! grep -q "import.*logger.*from.*@/lib/logger" "$file"; then
      # Add import at top (na eerste import line)
      sed -i "1a import { logger } from '@/lib/logger';" "$file"
    fi
    
    # Replace console.log → logger.log
    sed -i "s/console\\.log(/logger.log(/g" "$file"
    sed -i "s/console\\.info(/logger.info(/g" "$file"
    sed -i "s/console\\.warn(/logger.warn(/g" "$file"
    sed -i "s/console\\.error(/logger.error(/g" "$file"
    sed -i "s/console\\.debug(/logger.debug(/g" "$file"
  fi
done

echo "✅ Replacement complete!"
echo "⚠️ Please review changes and run: npm run build"
```

**Stap 3:** Handmatige review van kritieke logs

```typescript
// Voorbeeld: Dashboard.tsx

// VOOR:
console.log('🔍 LocalStorage check:', {
  wallet_address: localStorage.getItem('wallet_address'), // ❌ SENSITIVE
  has_password: localStorage.getItem('has_password'),
});

// NA:
logger.debug('LocalStorage check', {
  wallet_address: localStorage.getItem('wallet_address'), // ✅ Will be redacted in production
  has_password: localStorage.getItem('has_password'),
});

// Of beter: verwijder geheel als niet nodig
// (Alleen logs die écht nuttig zijn voor debugging)
```

**Stap 4:** Setup Sentry voor production error tracking

```bash
# Install Sentry
npm install @sentry/nextjs
```

```typescript
// sentry.client.config.ts (nieuw bestand)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  
  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions
  
  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of errors
  
  beforeSend(event, hint) {
    // Filter out sensitive data
    if (event.request) {
      // Remove query params with sensitive data
      if (event.request.url) {
        const url = new URL(event.request.url);
        url.searchParams.delete('address');
        url.searchParams.delete('wallet');
        event.request.url = url.toString();
      }
    }
    
    return event;
  },
});
```

```typescript
// sentry.server.config.ts (nieuw bestand)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
});
```

**Benodigde Bestanden:**
- 🆕 `lib/logger.ts` (nieuw)
- 🆕 `scripts/replace-console-logs.sh` (nieuw - voor bulk replace)
- ✏️ ALLE `.ts` en `.tsx` bestanden (670+ edits!)
- 🆕 `sentry.client.config.ts` (nieuw)
- 🆕 `sentry.server.config.ts` (nieuw)
- ✏️ `.env.local` (add NEXT_PUBLIC_SENTRY_DSN)

**Tijdsinschatting:** 2-3 uur (met script) of 10-12 uur (handmatig)

**Testing:**
```bash
# Test 1: Development mode
NODE_ENV=development npm run dev
# Open console - should see all logs

# Test 2: Production build
NODE_ENV=production npm run build
npm start
# Open console - should see NO logger.log/info/debug

# Test 3: Production errors
NODE_ENV=production npm start
# Trigger an error
# Check Sentry dashboard - should see error

# Test 4: Check sensitive data redaction
logger.log('User data', { address: '0x1234567890abcdef', name: 'John' });
# In production: should show '0x1234...cdef'
```

**Verificatie Checklist:**
- [ ] logger.ts geïmplementeerd
- [ ] Alle console.log vervangen door logger.log
- [ ] Alle console.error vervangen door logger.error
- [ ] Development mode toont alle logs
- [ ] Production mode toont GEEN debug logs
- [ ] Sentry captures errors in production
- [ ] Sensitive data wordt geredacted
- [ ] App build succeeds na changes

---

### HIGH-2: LocalStorage Voor Gevoelige Data (100+ uses)

**Probleem:**
Er worden 100+ localStorage operaties gebruikt, waarvan sommige niet-encrypted gevoelige data bevatten.

**Locaties:**
- `lib/wallet-store.ts`: 37 calls
- `lib/account-manager.ts`: 18 calls
- `lib/biometric-store.ts`: 9 calls
- `lib/supabase-auth.ts`: 13 calls

**Impact:**
- Severity: HIGH
- XSS attacks kunnen alle data stelen
- Geen automatic expiration
- Data blijft na browser close
- Niet alle data is encrypted

**Huidig onveilig:**
```typescript
localStorage.setItem('wallet_address', address); // ❌ PLAINTEXT!
localStorage.setItem('wallet_email', email); // ❌ PLAINTEXT!
localStorage.setItem('supabase_user_id', userId); // ❌ PLAINTEXT!
```

**Oplossing:**

**Optie A: Quick Fix - Encrypt Alle LocalStorage (2-3 uur)**

```typescript
// lib/secure-local-storage.ts (nieuw bestand)
import CryptoJS from 'crypto-js';

class SecureLocalStorage {
  private encryptionKey: string;
  
  constructor() {
    // Generate session-bound encryption key
    let sessionKey = sessionStorage.getItem('_storage_key');
    if (!sessionKey) {
      sessionKey = CryptoJS.lib.WordArray.random(256/8).toString();
      sessionStorage.setItem('_storage_key', sessionKey);
    }
    this.encryptionKey = sessionKey;
  }
  
  /**
   * Set item with automatic encryption
   */
  setItem(key: string, value: string): void {
    try {
      const encrypted = CryptoJS.AES.encrypt(value, this.encryptionKey).toString();
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Failed to set secure item:', error);
    }
  }
  
  /**
   * Get item with automatic decryption
   */
  getItem(key: string): string | null {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      
      const decrypted = CryptoJS.AES.decrypt(encrypted, this.encryptionKey);
      return decrypted.toString(CryptoJS.enc.Utf8) || null;
    } catch (error) {
      // If decryption fails, item might be unencrypted (migration)
      console.warn('Failed to decrypt item, returning raw value');
      return localStorage.getItem(key);
    }
  }
  
  /**
   * Remove item
   */
  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
  
  /**
   * Clear all items
   */
  clear(): void {
    localStorage.clear();
  }
}

export const secureStorage = new SecureLocalStorage();
```

**Usage:**
```typescript
// VOOR:
localStorage.setItem('wallet_address', address);
const address = localStorage.getItem('wallet_address');

// NA:
import { secureStorage } from '@/lib/secure-local-storage';
secureStorage.setItem('wallet_address', address);
const address = secureStorage.getItem('wallet_address');
```

**Optie B: IndexedDB Migration (12-16 uur) - AANBEVOLEN**

```typescript
// lib/secure-storage.ts (nieuw bestand)
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SecureStorageDB extends DBSchema {
  storage: {
    key: string;
    value: {
      data: string; // Encrypted
      iv: string;
      timestamp: number;
      expiresAt?: number;
    };
  };
}

class SecureStorage {
  private db: IDBPDatabase<SecureStorageDB> | null = null;
  private encryptionKey: CryptoKey | null = null;
  
  /**
   * Initialize database and encryption key
   */
  async init(): Promise<void> {
    if (this.db) return;
    
    // Open IndexedDB
    this.db = await openDB<SecureStorageDB>('blaze-secure-storage', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('storage')) {
          db.createObjectStore('storage');
        }
      },
    });
    
    // Generate or retrieve encryption key
    await this.initEncryptionKey();
  }
  
  /**
   * Initialize encryption key (session-bound)
   */
  private async initEncryptionKey(): Promise<void> {
    if (this.encryptionKey) return;
    
    // Get or create session ID
    let sessionId = sessionStorage.getItem('_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('_session_id', sessionId);
    }
    
    // Derive encryption key from session ID
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(sessionId),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('blaze-wallet-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  /**
   * Set item with encryption and optional expiration
   */
  async setItem(
    key: string, 
    value: string, 
    expiresInMs?: number
  ): Promise<void> {
    if (!this.db || !this.encryptionKey) await this.init();
    
    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt data
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey!,
      new TextEncoder().encode(value)
    );
    
    // Store in IndexedDB
    await this.db!.put('storage', {
      data: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
      timestamp: Date.now(),
      expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
    }, key);
  }
  
  /**
   * Get item with automatic decryption and expiration check
   */
  async getItem(key: string): Promise<string | null> {
    if (!this.db || !this.encryptionKey) await this.init();
    
    const item = await this.db!.get('storage', key);
    if (!item) return null;
    
    // Check expiration
    if (item.expiresAt && Date.now() > item.expiresAt) {
      await this.removeItem(key);
      return null;
    }
    
    // Decrypt data
    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: this.base64ToArrayBuffer(item.iv),
        },
        this.encryptionKey!,
        this.base64ToArrayBuffer(item.data)
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Failed to decrypt item:', error);
      return null;
    }
  }
  
  /**
   * Remove item
   */
  async removeItem(key: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('storage', key);
  }
  
  /**
   * Clear all items
   */
  async clear(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.clear('storage');
  }
  
  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    if (!this.db) await this.init();
    return await this.db!.getAllKeys('storage') as string[];
  }
  
  /**
   * Helper: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  /**
   * Helper: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  
  /**
   * Migration helper: Import from localStorage
   */
  async migrateFromLocalStorage(keys: string[]): Promise<void> {
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) {
        await this.setItem(key, value);
        localStorage.removeItem(key);
      }
    }
  }
}

export const secureStorage = new SecureStorage();

// Convenience: Initialize on module load
if (typeof window !== 'undefined') {
  secureStorage.init().catch(console.error);
}
```

**Install dependencies:**
```bash
npm install idb
```

**Migratie script:**
```typescript
// lib/storage-migration.ts
import { secureStorage } from './secure-storage';

export async function migrateToSecureStorage(): Promise<void> {
  const keysToMigrate = [
    'wallet_address',
    'wallet_email',
    'supabase_user_id',
    'current_chain',
    'biometric_enabled',
    // Add more keys as needed
  ];
  
  console.log('🔄 Starting storage migration...');
  
  try {
    await secureStorage.migrateFromLocalStorage(keysToMigrate);
    console.log('✅ Storage migration complete');
    
    // Mark migration as done
    localStorage.setItem('storage_migrated', 'true');
  } catch (error) {
    console.error('❌ Storage migration failed:', error);
  }
}
```

**Update app/layout.tsx:**
```typescript
// app/layout.tsx
'use client';

import { useEffect } from 'react';
import { migrateToSecureStorage } from '@/lib/storage-migration';

export default function RootLayout({ children }) {
  useEffect(() => {
    // Run migration once
    const migrated = localStorage.getItem('storage_migrated');
    if (!migrated) {
      migrateToSecureStorage();
    }
  }, []);
  
  return <html><body>{children}</body></html>;
}
```

**Update alle localStorage calls:**
```typescript
// VOOR: lib/wallet-store.ts
localStorage.setItem('wallet_address', address);
const address = localStorage.getItem('wallet_address');

// NA:
import { secureStorage } from '@/lib/secure-storage';
await secureStorage.setItem('wallet_address', address);
const address = await secureStorage.getItem('wallet_address');
```

**Benodigde Bestanden:**
- 🆕 `lib/secure-local-storage.ts` (Optie A) OF
- 🆕 `lib/secure-storage.ts` (Optie B) + `npm install idb`
- 🆕 `lib/storage-migration.ts`
- ✏️ `app/layout.tsx`
- ✏️ `lib/wallet-store.ts` (37 edits)
- ✏️ `lib/account-manager.ts` (18 edits)
- ✏️ `lib/biometric-store.ts` (9 edits)
- ✏️ `lib/supabase-auth.ts` (13 edits)
- ✏️ Alle andere bestanden met localStorage (50+ edits)

**Tijdsinschatting:**
- Optie A (Quick Fix): 2-3 uur
- Optie B (IndexedDB): 12-16 uur

**Testing:**
```javascript
// Test 1: Set & Get
await secureStorage.setItem('test', 'value');
const value = await secureStorage.getItem('test');
console.assert(value === 'value', 'Storage works');

// Test 2: XSS Attack Simulation
// In DevTools Console (simulating XSS):
localStorage.getItem('wallet_address');
// Expected: Encrypted gibberish, not plaintext

// Test 3: Session expiration
await secureStorage.setItem('temp', 'value', 5000); // 5 seconds
await new Promise(r => setTimeout(r, 6000));
const expired = await secureStorage.getItem('temp');
console.assert(expired === null, 'Expiration works');

// Test 4: Migration
// Open DevTools → Application → Local Storage
// Should be empty or only have 'storage_migrated'
// Open IndexedDB → blaze-secure-storage
// Should have all migrated keys
```

**Verificatie Checklist:**
- [ ] secureStorage library geïmplementeerd
- [ ] Alle localStorage.setItem vervangen
- [ ] Alle localStorage.getItem vervangen
- [ ] Migratie script werkt
- [ ] Data encrypted in storage (check DevTools)
- [ ] App functionality onveranderd
- [ ] Session-bound encryption (expires on tab close)
- [ ] No plaintext sensitive data in storage

---

## 🟡 MEDIUM PRIORITY ISSUES (Verkorte Lijst)

### MEDIUM-1: Alert() Vervangen Door Toast (32 calls)

**Probleem:** 32 alert() calls in 7 components - blocking UI, slechte UX

**Oplossing:**
```bash
npm install react-hot-toast

# app/layout.tsx
import { Toaster } from 'react-hot-toast';
<Toaster position="top-center" />

# Replace all alert():
import toast from 'react-hot-toast';
toast.error('Error message');
toast.success('Success!');
```

**Tijd:** 2 uur

---

### MEDIUM-2: Transak Key Server-Side

**Probleem:** `NEXT_PUBLIC_TRANSAK_API_KEY` is client-visible

**Oplossing:**
```typescript
// app/api/transak/init/route.ts (nieuw)
export async function POST(req) {
  const { walletAddress, amount } = await req.json();
  const token = await generateTransakSession({
    apiKey: process.env.TRANSAK_API_KEY, // Server-only!
    walletAddress,
    amount,
  });
  return NextResponse.json({ token });
}
```

**Tijd:** 1-2 uur

---

### MEDIUM-3 t/m MEDIUM-12: Andere Issues

(Details beschikbaar - laat het weten als je deze wilt)

---

## 🔵 LOW PRIORITY ISSUES (Verkorte Lijst)

### LOW-1: Bundle Size Optimization (4.7MB → 1.5MB)

**Oplossing:** Dynamic imports voor blockchain libraries

**Tijd:** 6-8 uur

---

### LOW-2: Image Optimization (1.4MB → 50KB)

**Oplossing:** WebP conversie + compression

**Tijd:** 2-3 uur

---

### LOW-3 t/m LOW-18: Andere Optimalisaties

(Details beschikbaar - 16 meer optimalisaties)

---

## 📊 COMPLETE OVERZICHT

### Issues Per Prioriteit

| Prioriteit | Aantal | Totale Tijd |
|------------|--------|-------------|
| 🔴 CRITICAL | 3 | 6-8 uur |
| 🔴 HIGH | 4 | 20-24 uur |
| 🟡 MEDIUM | 12 | 18-24 uur |
| 🔵 LOW | 16 | 40-50 uur |
| **TOTAAL** | **35** | **84-106 uur** |

### Kosten Schatting

**Development (@€75/uur):**
- CRITICAL: €450-600
- HIGH: €1,500-1,800
- MEDIUM: €1,350-1,800
- LOW: €3,000-3,750
- **TOTAAL: €6,300-7,950**

---

## 🎯 AANBEVOLEN PRIORITERING

### **Fase 1: Critical Security (Deze Week)**
1. ✅ CRITICAL-1: CORS Fix (1-2u)
2. ✅ CRITICAL-2: CSRF Protection (3-4u)  
3. ✅ HIGH-2: Transak Server-Side (1-2u)

**Totaal: 5-8 uur | Cost: €375-600**

### **Fase 2: Production Readiness (Week 2)**
4. ✅ HIGH-1: Console Logging Fix (2-3u)
5. ✅ CRITICAL-3: CSP Nonce-Based (4-6u)
6. ✅ MEDIUM-1: Toast Notifications (2u)

**Totaal: 8-11 uur | Cost: €600-825**

### **Fase 3: Enhanced Security (Week 3-4)**
7. ✅ HIGH-2: IndexedDB Migration (12-16u)

**Totaal: 12-16 uur | Cost: €900-1,200**

### **Fase 4: Performance (Maand 2)**
8. ✅ LOW-1: Bundle Optimization (6-8u)
9. ✅ LOW-2: Image Optimization (2-3u)
10. ✅ Overige LOW priority (32-39u)

**Totaal: 40-50 uur | Cost: €3,000-3,750**

---

## ✅ ACTION ITEMS

**Kies uit onderstaande opties:**

```
OPTIE A: Critical Only (Deze Week)
⏱️ Tijd: 5-8 uur
💰 Cost: €375-600
✅ Items: CRITICAL-1, CRITICAL-2, HIGH-2

OPTIE B: Security Complete (2 Weken)
⏱️ Tijd: 17-25 uur
💰 Cost: €1,275-1,875
✅ Items: Alle CRITICAL + HIGH-1, MEDIUM-1

OPTIE C: Production Ready (1 Maand)
⏱️ Tijd: 29-41 uur
💰 Cost: €2,175-3,075
✅ Items: Alle CRITICAL + HIGH + essentiële MEDIUM

OPTIE D: Complete Overhaul (2 Maanden)
⏱️ Tijd: 84-106 uur
💰 Cost: €6,300-7,950
✅ Items: ALLE 35 issues
```

---

**Welke issues wil je dat ik fixeer? Geef aan:**
- Specifieke issue nummers (bijv: "Fix CRITICAL-1, CRITICAL-2, HIGH-1")
- Een optie (bijv: "Doe OPTIE B")
- Custom selectie (bijv: "Alle CRITICAL + HIGH-1 + LOW-1")

Zodra je aangeeft wat je wilt, begin ik met de implementatie! 🚀

