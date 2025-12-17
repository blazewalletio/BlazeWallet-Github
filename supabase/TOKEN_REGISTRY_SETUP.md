# 🪙 Token Registry Setup Guide

## Overzicht

De Token Registry slaat ALLE tokens voor ALLE chains op in Supabase met full-text search. Dit zorgt voor:
- ✅ **Instant search** (geen wachttijd!)
- ✅ **Alle tokens beschikbaar** (Jupiter voor Solana, CoinGecko voor EVM chains)
- ✅ **Werkt voor alle 18 chains**
- ✅ **Sneller dan MetaMask/Phantom** (PostgreSQL full-text search)

## Stap 1: Voer de Migration Uit

1. Open Supabase Dashboard → SQL Editor
2. Kopieer de inhoud van `supabase/migrations/20251215000002_create_token_registry.sql`
3. Voer de SQL uit

Dit maakt:
- `token_registry` table met full-text search
- RPC functions: `search_tokens()`, `get_popular_tokens()`, `get_token_count()`
- Indexes voor snelle queries

## Stap 2: Eerste Sync (Vul Database)

### Optie A: Via API (Aanbevolen)

```bash
# Trigger sync job (vervang YOUR_CRON_SECRET met je CRON_SECRET env var)
curl -X POST https://my.blazewallet.io/api/tokens/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

### Optie B: Via Supabase Dashboard

1. Ga naar Supabase Dashboard → Edge Functions (of gebruik SQL Editor)
2. Voer de sync job handmatig uit via de API route

**Let op:** De eerste sync kan 10-30 minuten duren (afhankelijk van hoeveel tokens er zijn). Dit gebeurt in de background - gebruikers kunnen al direct zoeken zodra er tokens in de database staan!

## Stap 3: Automatische Updates (Cron Job)

Voeg toe aan `vercel.json` of Vercel Cron Jobs:

```json
{
  "crons": [
    {
      "path": "/api/tokens/sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Dit sync tokens elke 6 uur automatisch.

Of gebruik Supabase pg_cron:

```sql
-- Sync tokens elke 6 uur
SELECT cron.schedule(
  'sync-tokens',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://my.blazewallet.io/api/tokens/sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

## Ondersteunde Chains

### Solana
- **Source:** Jupiter API (`https://token.jup.ag/all`)
- **Tokens:** ~287,000+ tokens
- **Sync tijd:** ~5-10 minuten

### EVM Chains (via CoinGecko)
- **Ethereum** (`platforms.ethereum`)
- **Polygon** (`platforms.polygon-pos`)
- **Arbitrum** (`platforms.arbitrum-one`)
- **Base** (`platforms.base`)
- **BSC** (`platforms.binance-smart-chain`)
- **Optimism** (`platforms.optimistic-ethereum`)
- **Avalanche** (`platforms.avalanche`)
- **Fantom** (`platforms.fantom`)
- **Cronos** (`platforms.cronos`)
- **zkSync** (`platforms.zksync`) - mogelijk beperkt
- **Linea** (`platforms.linea`) - mogelijk beperkt

**Sync tijd per chain:** ~1-2 minuten

## Database Schema

```sql
token_registry (
  id UUID PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  chain_key TEXT NOT NULL, -- 'solana', 'ethereum', etc.
  address TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals INTEGER DEFAULT 18,
  logo_uri TEXT,
  price_usd DECIMAL(20, 8),
  coingecko_id TEXT,
  jupiter_mint TEXT, -- For Solana
  is_verified BOOLEAN DEFAULT false,
  is_popular BOOLEAN DEFAULT false,
  search_vector tsvector, -- Full-text search (auto-generated)
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(chain_id, address)
)
```

## Full-Text Search

De `search_tokens()` RPC function gebruikt PostgreSQL full-text search:

```sql
SELECT * FROM search_tokens('solana', 'TRUMP', 200);
```

Dit zoekt door:
- Symbol (prioriteit A)
- Name (prioriteit B)
- Address (prioriteit C)

Resultaten worden gesorteerd op:
1. Exact symbol match
2. Symbol starts with query
3. Popular tokens first
4. Verified tokens first
5. Shorter symbols first

## Monitoring

Check token counts per chain:

```sql
SELECT 
  chain_key,
  COUNT(*) as token_count,
  COUNT(*) FILTER (WHERE is_popular) as popular_count,
  COUNT(*) FILTER (WHERE is_verified) as verified_count
FROM token_registry
GROUP BY chain_key
ORDER BY token_count DESC;
```

## Troubleshooting

### Geen tokens zichtbaar?
1. Check of de migration is uitgevoerd
2. Check of de sync job is gedraaid: `SELECT COUNT(*) FROM token_registry;`
3. Check logs in Vercel voor sync job errors

### Search werkt niet?
1. Check of `search_vector` is gevuld: `SELECT search_vector FROM token_registry LIMIT 1;`
2. Check of de trigger werkt: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_token_search_vector';`

### Sync job faalt?
1. Check CoinGecko rate limits (gratis tier: 10-50 calls/minuut)
2. Check Jupiter API status
3. Check Supabase connection

## Performance

- **Search latency:** <100ms (PostgreSQL full-text search)
- **Database size:** ~500MB-1GB voor alle tokens
- **Query performance:** Excellent (GIN indexes op search_vector)

## Security

- ✅ RLS enabled: iedereen kan tokens lezen (public data)
- ✅ Alleen service role kan tokens inserten/updaten (sync job)
- ✅ No sensitive data stored

