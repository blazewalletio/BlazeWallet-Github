# 🔥 VERCEL DEPLOYMENT PROTECTION FIX - CRON JOBS

## Het Probleem

De Vercel cron jobs worden NIET automatisch uitgevoerd omdat er **Deployment Protection** (Vercel Authentication) actief is op de deployment. 

Wanneer je probeert de cron endpoint te bereiken, krijg je een "Authentication Required" scherm. Dit blokkeert niet alleen externe requests, maar ook Vercel's eigen cron service!

## De Oplossing

Je moet de Deployment Protection uitschakelen voor de **Production** omgeving in het Vercel Dashboard.

### Stappen om te Fixen

1. **Open het Vercel Dashboard**
   - Ga naar: https://vercel.com/blaze-wallets-projects/blaze-wallet

2. **Ga naar Settings → Deployment Protection**
   - Klik op "Settings" in de top navigatie
   - Scroll naar "Deployment Protection"

3. **Schakel Protection uit voor Production**
   - Bij "Production Deployments" zie je waarschijnlijk dat er een vorm van bescherming actief is
   - Kies één van deze opties:
     - **Optie A (Aanbevolen)**: Zet "Vercel Authentication" op "Off" voor Production
     - **Optie B**: Selecteer "Standard Protection" zonder extra authentication
     - **Optie C**: Gebruik alleen "Spend Management" protection (budget limits)

4. **Save en Test**
   - Klik op "Save"
   - Wacht 1-2 minuten
   - Test de cron endpoint handmatig:
     ```bash
     curl "https://blaze-wallet.vercel.app/api/cron/execute-scheduled-txs?CRON_SECRET=je_secret_hier"
     ```
   - Je zou nu JSON output moeten zien in plaats van een authenticatie scherm

## Waarom Dit Gebeurt

Vercel's Deployment Protection is bedoeld om te voorkomen dat onbevoegden toegang krijgen tot je preview/development deployments. Maar als je het ook op Production inschakelt, dan:

1. Alle requests naar je app vereisen authenticatie
2. Dit geldt ook voor Vercel's eigen cron service
3. De cron service kan niet authenticeren → cron jobs falen stilletjes
4. Je ziet in de Vercel logs alleen het authentication scherm, geen echte cron execution

## Na de Fix

Na het uitschakelen van Deployment Protection voor Production:

1. ✅ Cron jobs kunnen automatisch elke 5 minuten draaien
2. ✅ Je app blijft publiek toegankelijk (wat je wilt voor een wallet)
3. ✅ Preview deployments kunnen nog steeds beschermd blijven
4. ✅ Security blijft gewaarborgd via de CRON_SECRET in de code

## Alternative: Als je Protection wil houden

Als je om een specifieke reden Deployment Protection wil houden voor Production, dan zijn er alternatieven:

### Optie 1: Gebruik Vercel's Webhook Protection Bypass
Dit is complex en niet aanbevolen voor cron jobs.

### Optie 2: Verplaats naar externe cron service
- Gebruik een externe service zoals Cron-Job.org of EasyCron
- Laat hen elke 5 minuten je endpoint aanroepen met de CRON_SECRET
- Nadeel: Extra dependency en mogelijk minder betrouwbaar

### Optie 3: Gebruik Supabase Edge Functions met pg_cron
- Verplaats de scheduled transaction executor naar Supabase
- Gebruik Postgres `pg_cron` extension
- Nadeel: Grote refactor nodig

## Aanbeveling

**Schakel gewoon Deployment Protection uit voor Production.** 

Het is een publieke wallet app, je wilt dat gebruikers toegang hebben. De cron endpoint is al beveiligd met:
- CRON_SECRET environment variable
- Verificatie van Vercel headers
- Rate limiting via Vercel

Je hebt geen extra authentication layer nodig die je eigen functionaliteit breekt.

## Status

- [ ] Deployment Protection uitgeschakeld in Vercel Dashboard
- [ ] Cron endpoint getest (moet JSON returnen, geen auth scherm)
- [ ] Nieuwe transactie ingepland om te testen
- [ ] Gewacht 5+ minuten om te zien of het automatisch uitvoert

---

**Timestamp**: 11 november 2024
**Issue**: Cron jobs worden niet automatisch uitgevoerd
**Root Cause**: Vercel Authentication blokkeert cron service
**Fix**: Deployment Protection uitschakelen voor Production

