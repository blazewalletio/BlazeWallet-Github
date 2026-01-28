# ⏰ EasyCron Setup - Analytics Aggregation Job

## 📋 Overzicht

Deze cron job draait **elk uur** en voert de volgende taken uit:
1. Update user cohorts en segmentatie
2. Bereken engagement scores
3. Update realtime metrics voor dashboard
4. Detecteer anomalieën en maak alerts
5. Cleanup verlopen data

---

## 🔧 EasyCron Configuratie

### Stap 1: Login bij EasyCron
Ga naar: https://www.easycron.com/user/login

### Stap 2: Maak Nieuwe Cron Job
1. Klik op **"+ Cron Job"**
2. Vul de volgende gegevens in:

**Basic Settings:**
- **Cron Job Name**: `BLAZE Analytics Aggregation`
- **URL**: `https://my.blazewallet.io/api/cron/aggregate-analytics`
- **Cron Expression**: `0 * * * *` (elk uur op het hele uur)
  - Of via UI: **Every Hour** → **At minute 0**

**HTTP Settings:**
- **HTTP Method**: `GET`
- **HTTP Headers**: 
  ```
  Authorization: Bearer YOUR_CRON_SECRET_HERE
  ```
  ⚠️ **Belangrijk**: Vervang `YOUR_CRON_SECRET_HERE` met je daadwerkelijke `CRON_SECRET` uit Vercel

**Advanced Settings:**
- **Timeout**: `60 seconds`
- **Retry Times**: `2`
- **Alert Me When Job Fails**: ✅ **Enabled**
- **Email for Alerts**: `ricks_@live.nl`

### Stap 3: Test de Cron Job
1. Klik op **"Test"** knop
2. Verwachte response:
   ```json
   {
     "success": true,
     "duration": "1234ms",
     "timestamp": "2026-01-28T20:00:00.000Z"
   }
   ```
3. Check Vercel logs voor bevestiging

### Stap 4: Enable de Cron Job
1. Zet de toggle op **"Enabled"**
2. Save de job

---

## 🔐 Vercel Environment Variable

Zorg dat `CRON_SECRET` is ingesteld in Vercel:

1. Ga naar Vercel Dashboard → Project → Settings → Environment Variables
2. Als `CRON_SECRET` nog niet bestaat:
   ```bash
   # Genereer een secure random secret
   openssl rand -base64 32
   ```
3. Voeg toe:
   - **Key**: `CRON_SECRET`
   - **Value**: `[generated secret]`
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development

---

## 📊 Monitoring

### Check Cron Job Status
**EasyCron Dashboard**: https://www.easycron.com/user/cronjobs

### Check Execution Logs
1. Ga naar EasyCron dashboard
2. Klik op job naam
3. Bekijk **"Execution History"**

### Check Vercel Logs
```bash
vercel logs --follow
```

Filter op `[Analytics Cron]` voor relevante logs.

---

## 🧪 Manual Testing

Test de cron job handmatig via curl:

```bash
curl -X GET https://my.blazewallet.io/api/cron/aggregate-analytics \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Verwachte output:
```json
{
  "success": true,
  "duration": "1234ms",
  "timestamp": "2026-01-28T20:00:00.000Z"
}
```

---

## ⚠️ Troubleshooting

### Error: "Unauthorized"
- Check of `CRON_SECRET` correct is ingesteld in Vercel
- Check of Authorization header correct is in EasyCron
- Test met curl om te bevestigen

### Error: "Timeout"
- Verhoog timeout in EasyCron naar 90 seconds
- Check Supabase database performance
- Check Vercel function limits

### Error: "Internal Server Error"
- Check Vercel logs voor stack trace
- Verificeer dat alle database tables bestaan
- Check of `SUPABASE_SERVICE_ROLE_KEY` correct is

---

## 📈 Expected Behavior

**Hourly Execution:**
- Runs at: 00:00, 01:00, 02:00, ... 23:00 UTC
- Duration: ~2-5 seconds (afhankelijk van aantal users)
- Updates: User cohorts, engagement scores, realtime metrics
- Alerts: Only created when anomalies detected

**Database Impact:**
- Minimal: Only updates existing records + inserts metrics/alerts
- No heavy queries during peak hours
- Indexed queries for performance

---

## 🔄 Backup Plan

Als EasyCron niet werkt, alternatieve opties:

1. **Vercel Cron** (Beta):
   ```json
   // vercel.json
   {
     "crons": [{
       "path": "/api/cron/aggregate-analytics",
       "schedule": "0 * * * *"
     }]
   }
   ```

2. **GitHub Actions**:
   - Create workflow `.github/workflows/analytics-cron.yml`
   - Gebruik secrets voor `CRON_SECRET`

3. **CloudFlare Workers**:
   - Deploy worker met cron trigger
   - Call Vercel endpoint

---

## ✅ Verificatie Checklist

- [ ] `CRON_SECRET` is ingesteld in Vercel
- [ ] EasyCron job is aangemaakt met correcte URL
- [ ] Authorization header is correct geconfigureerd
- [ ] Test run is successful (200 response)
- [ ] Email alerts zijn enabled
- [ ] Job is enabled (niet paused)
- [ ] Eerste automated run is successful
- [ ] Vercel logs tonen correcte execution

---

## 📞 Support

Bij problemen:
1. Check EasyCron execution history
2. Check Vercel function logs
3. Test manually via curl
4. Check database connectivity

EasyCron Support: https://www.easycron.com/support

