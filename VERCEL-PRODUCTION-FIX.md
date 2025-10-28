# VERCEL PRODUCTION BRANCH FIX

## 🎯 Probleem
Elke Git push naar `main` gaat naar **Preview** in plaats van **Production**.

## ✅ Oplossing (1x handmatig)

### Stap 1: Open Vercel Dashboard
```
https://vercel.com/blaze-wallets-projects/blaze-wallet
```

### Stap 2: Ga naar Settings
Klik op de **"Settings"** tab bovenin het scherm.

### Stap 3: Ga naar Git sectie
In het linker menu, klik op **"Git"**.

### Stap 4: Production Branch wijzigen
Zoek naar de sectie **"Production Branch"**.

Je ziet waarschijnlijk:
```
Production Branch: [master] ← of iets anders
```

Verander dit naar:
```
Production Branch: [main] ✅
```

### Stap 5: Save
Klik onderaan op de **"Save"** button.

---

## 🎉 Resultaat
✅ Vanaf nu gaat **elke Git push naar main** automatisch naar **Production**!  
✅ Geen handmatig promoten meer nodig!

---

## 📋 Tot die tijd (Workaround)

Gebruik het deploy script:
```bash
./deploy-production.sh
```

Dit deployt **altijd** direct naar Production, ongeacht Vercel settings.

---

## 🔍 Verificatie

Check de deployments lijst na een Git push:
- **Voor fix**: Deployment gaat naar "Preview" ❌
- **Na fix**: Deployment gaat naar "Production" ✅

---

## 💡 Waarom gebeurt dit?

Vercel's dashboard **"Production Branch"** setting heeft **hogere prioriteit** dan `vercel.json`.

Je dashboard staat waarschijnlijk ingesteld op:
- `master` (oude default)
- `production`
- Of: geen production branch

Daarom gaan alle `main` pushes naar Preview!

---

## ✅ Script gebruikt tot dashboard fix klaar is

Het `deploy-production.sh` script:
1. ✅ Checkt of je op `main` branch zit
2. ✅ Checkt of er geen uncommitted changes zijn
3. ✅ Deployed direct naar Production via `vercel --prod`
4. ✅ Bypassed alle dashboard settings

**Gebruik dit tot je de dashboard fix hebt gedaan!**

