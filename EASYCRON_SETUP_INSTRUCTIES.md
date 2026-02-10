# 🔥 EASYCRON SETUP - STAP VOOR STAP

## ✅ Account aangemaakt: info@blazewallet.io

---

## 📋 STAP 1: CRON_SECRET OPHALEN

Je hebt een `CRON_SECRET` nodig voor authenticatie. Haal deze op:

### **Optie A: Via Vercel Dashboard (Aanbevolen)**
1. Ga naar: https://vercel.com/dashboard
2. Selecteer je project: **Blaze Wallet**
3. Ga naar: **Settings** → **Environment Variables**
4. Zoek: `CRON_SECRET`
5. **Klik op het oog-icoon** om de waarde te zien
6. **Kopieer de waarde** (zonder quotes)

### **Optie B: Via Vercel CLI**
```bash
cd "/Users/rickschlimback/Desktop/BLAZE Wallet 29-12"
vercel link  # Als je nog niet gelinkt bent
vercel env pull .env.vercel.production --environment=production
grep CRON_SECRET .env.vercel.production
```

**BELANGRIJK**: Als er geen `CRON_SECRET` bestaat, genereer er een:
```bash
openssl rand -hex 32
```
En voeg deze toe aan Vercel environment variables.

---

## 📋 STAP 2: EASYCRON CRON JOB AANMAKEN

### **2.1 Ga naar EasyCron Dashboard**
1. Open: https://www.easycron.com/cron-jobs
2. Je bent ingelogd als: **info@blazewallet.io**

### **2.2 Klik op "+ Cron Job"**

### **2.3 Vul de volgende gegevens in:**

#### **Basic Settings:**
- **Cron Job Name**: `Blaze Wallet - Smart Scheduler`
- **Cron Job URL**: 
  ```
  https://my.blazewallet.io/api/cron/execute-scheduled-txs?CRON_SECRET=JE_CRON_SECRET_HIER
  ```
  *(Vervang `JE_CRON_SECRET_HIER` met de waarde uit Stap 1)*

#### **Schedule:**
- **Cron Expression**: `*/5 * * * *` (elke 5 minuten)
- Of gebruik de **Schedule Builder**:
  - Frequency: **Every**
  - Interval: **5**
  - Unit: **Minutes**

#### **HTTP Settings:**
- **HTTP Method**: `GET`
- **Timeout**: `300` seconden (5 minuten)
- **Retry**: `3` retries bij failure
- **Retry Interval**: `60` seconden

#### **Notifications:**
- **Email Notification**: ✅ **Enabled**
- **Notify on**: ✅ **Failure only** (of "Always" voor testing)
- **Email**: `info@blazewallet.io`

#### **Advanced (Optioneel):**
- **Status**: ✅ **Enabled**
- **Log Level**: `Normal` (of `Verbose` voor debugging)

### **2.4 Klik "Save"**

---

## 📋 STAP 3: TESTEN

### **3.1 Test in EasyCron Dashboard**
1. Ga naar je cron job in EasyCron
2. Klik op **"Test"** of **"Run Now"**
3. Wacht 10-30 seconden
4. Check de **"Execution History"** tab
5. Je zou moeten zien:
   - ✅ Status: **Success**
   - ✅ HTTP Code: **200**
   - ✅ Response: JSON met `{"success": true, ...}`

### **3.2 Verify in Vercel Logs**
```bash
vercel logs --follow
```
Of via Vercel Dashboard:
1. Ga naar: https://vercel.com/dashboard
2. Selecteer project → **Deployments** → **Functions**
3. Zoek: `/api/cron/execute-scheduled-txs`
4. Check logs voor execution

### **3.3 Verify Database**
Check of transactions worden uitgevoerd:
```sql
-- In Supabase SQL Editor
SELECT 
  id,
  status,
  scheduled_for,
  executed_at,
  created_at
FROM scheduled_transactions
WHERE status IN ('executing', 'completed', 'failed')
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📋 STAP 4: VERCEL CRON UITSCHAKELEN

Nu EasyCron werkt, kunnen we Vercel Cron uitschakelen:

### **4.1 Update vercel.json**
De cron configuratie wordt verwijderd (ik doe dit automatisch).

### **4.2 Deploy naar Vercel**
```bash
cd "/Users/rickschlimback/Desktop/BLAZE Wallet 29-12"
git add vercel.json
git commit -m "chore: Disable Vercel Cron, migrate to EasyCron"
git push origin main
```

Of deploy direct:
```bash
vercel --prod
```

---

## 📋 STAP 5: MONITORING OPZETTEN

### **5.1 EasyCron Dashboard**
- Check dagelijks: https://www.easycron.com/cron-jobs
- Kijk naar **Execution History**
- Check voor failures

### **5.2 Email Alerts**
Je ontvangt automatisch emails bij:
- ❌ Cron job failures
- ⚠️ Timeouts
- 🔄 Retry attempts

### **5.3 Vercel Logs (Blijft werken)**
```bash
vercel logs --follow
```

---

## ✅ VERIFICATIE CHECKLIST

Na implementatie, verify:

- [ ] EasyCron cron job is **Enabled**
- [ ] Test execution in EasyCron is **Success**
- [ ] Vercel logs tonen execution (met EasyCron user-agent)
- [ ] Scheduled transactions worden uitgevoerd
- [ ] Vercel Cron is uitgeschakeld (geen dubbele executions)
- [ ] Email notifications werken

---

## 🆘 TROUBLESHOOTING

### **Probleem: 401 Unauthorized**
**Oplossing**: 
- Check of `CRON_SECRET` correct is in EasyCron URL
- Check of `CRON_SECRET` in Vercel environment variables bestaat
- Verify geen trailing spaces in URL

### **Probleem: Timeout**
**Oplossing**:
- Verhoog timeout in EasyCron naar 300 seconden
- Check Vercel function timeout (moet 300s zijn voor cron endpoints)

### **Probleem: Cron draait niet**
**Oplossing**:
- Check of cron job **Enabled** is in EasyCron
- Check execution history voor errors
- Verify schedule is correct (`*/5 * * * *`)

### **Probleem: Dubbele executions**
**Oplossing**:
- Verify Vercel Cron is uitgeschakeld
- Check `vercel.json` heeft geen `crons` array meer

---

## 📞 SUPPORT

Als er problemen zijn:
1. Check EasyCron execution history
2. Check Vercel logs
3. Check Supabase database voor transaction status
4. Email: info@blazewallet.io

---

**Laatste update**: 29 december 2025
**Status**: Klaar voor implementatie ✅


