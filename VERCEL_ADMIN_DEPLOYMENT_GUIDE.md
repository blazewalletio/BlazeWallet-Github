# 🚀 VERCEL DEPLOYMENT GIDS - ADMIN

## ⚠️ HUIDIGE STATUS

✅ **Code:**
- Alle features compleet
- Lokale builds slagen
- GitHub up-to-date (commit: 42d83f1f)

✅ **Main Wallet:**
- Deployt automatisch naar https://blazewallet.io
- Werkt perfect

❌ **Admin Panel:**
- Lokaal werkt perfect (`:3002`)
- Vercel deployment faalt (monorepo issue)

---

## 🔍 HET PROBLEEM

De admin app zit in een **monorepo** (`apps/admin`) en heeft toegang nodig tot:
- `lib/` folder (shared services)
- Root `node_modules`
- Root `package.json` dependencies

Vercel weet niet automatisch hoe het een monorepo moet builden.

---

## 💡 OPLOSSING (3 opties)

### **OPTIE 1: Vercel Settings Aanpassen** ⭐ AANBEVOLEN

Dit is het makkelijkst - pas gewoon de settings aan:

1. **Ga naar Vercel Dashboard:**
   ```
   https://vercel.com/blaze-wallets-projects/admin/settings
   ```

2. **Scroll naar "Build & Development Settings"**

3. **Pas aan:**
   - **Root Directory**: `apps/admin` (of leeg laten)
   - **Install Command**: Overschrijf met:
     ```bash
     npm install
     ```
   - **Build Command**: Overschrijf met:
     ```bash
     npm run build
     ```
   - **Output Directory**: `.next` (default is OK)

4. **Environment Variables checken:**
   - `NEXT_PUBLIC_SUPABASE_URL` ✅
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
   - `SUPABASE_SERVICE_ROLE_KEY` ✅

5. **Save & Redeploy:**
   - Klik "Save"
   - Ga naar "Deployments" tab
   - Klik "Redeploy" op laatste deployment

**Expected result:** Admin deployt naar https://admin.blazewallet.io

---

### **OPTIE 2: Nieuwe Vercel Project** (als optie 1 faalt)

Maak een nieuw project vanaf scratch met correcte configuratie:

1. **Verwijder huidige admin project:**
   ```
   https://vercel.com/blaze-wallets-projects/admin/settings/advanced
   → Delete Project
   ```

2. **Maak nieuw project:**
   - Ga naar: https://vercel.com/new
   - Kies: `BlazeWallet21-10` repository
   - Framework Preset: **Next.js**
   - Root Directory: **apps/admin**
   - Build Command: `npm run build`
   - Install Command: `npm install`

3. **Environment Variables toevoegen:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Deploy:**
   - Klik "Deploy"
   - Wacht 2-3 minuten
   - Check: https://admin-[random].vercel.app

5. **Custom domain instellen:**
   - Settings → Domains
   - Add: `admin.blazewallet.io`

---

### **OPTIE 3: Manual Deploy vanaf Lokaal** (temporary)

Als je snel wilt testen zonder Vercel config:

```bash
cd "/Users/rickschlimback/Desktop/BLAZE Wallet 29-12/apps/admin"

# Build lokaal
npm run build

# Deploy standalone
vercel --prod --yes

# Dit werkt maar is niet auto-deploy
```

**Nadeel:** Werkt niet voor auto-deployment vanaf GitHub.

---

## 🎯 WELKE OPTIE?

| Optie | Tijd | Auto-Deploy | Aanbeveling |
|-------|------|-------------|-------------|
| 1. Settings | 2 min | ✅ | ⭐⭐⭐ BESTE |
| 2. Nieuw Project | 5 min | ✅ | ⭐⭐ Backup |
| 3. Manual | 1 min | ❌ | ⭐ Quick test |

**→ Probeer eerst OPTIE 1!**

---

## 📋 STAP-VOOR-STAP (Optie 1 - Gedetailleerd)

### **1. Open Vercel Dashboard**
```
https://vercel.com/blaze-wallets-projects/admin
```

### **2. Ga naar Settings**
- Klik "Settings" tab (naast "Deployments")
- Scroll naar "Build & Development Settings"

### **3. Klik "Override"**
- Bij "Build Command": klik "Override"
- Bij "Install Command": klik "Override"

### **4. Vul in:**
```
Install Command:  npm install
Build Command:    npm run build
Output Directory: .next
```

### **5. Save**
- Scroll naar beneden
- Klik "Save"

### **6. Redeploy**
- Ga terug naar "Deployments" tab
- Vind laatste deployment (42d83f1f)
- Klik "..." menu
- Klik "Redeploy"
- Wacht 2-3 minuten

### **7. Check Result**
```
https://admin.blazewallet.io
```

Should show: Admin login page ✅

---

## ✅ CHECKLIST NA DEPLOYMENT

- [ ] Admin URL werkt: https://admin.blazewallet.io
- [ ] Login pagina toont
- [ ] Kan inloggen met admin credentials
- [ ] Dashboard laadt
- [ ] Users tab werkt
- [ ] Kan user details zien
- [ ] "View Balances" button werkt
- [ ] Portfolio USD waarden tonen

---

## 🐛 TROUBLESHOOTING

### **Build faalt nog steeds:**
1. Check build logs in Vercel:
   ```
   Deployments → [laatst] → "View Build Logs"
   ```

2. Zoek naar specifieke error
3. Veel voorkomende issues:
   - Missing env vars → Check Settings → Environment Variables
   - Module not found → Check install command
   - TypeScript errors → Lokaal eerst `npm run build` runnen

### **Build slaagt maar site laadt niet:**
1. Check Function logs:
   ```
   Deployments → [laatst] → "View Function Logs"
   ```

2. Check voor 500 errors
3. Verify env vars zijn correct

### **Admin werkt maar API's niet:**
1. Check Environment Variables:
   ```
   Settings → Environment Variables
   ```

2. Verify:
   - `SUPABASE_SERVICE_ROLE_KEY` set (Production)
   - `NEXT_PUBLIC_SUPABASE_URL` set (Production)

---

## 📞 SUPPORT

### **Als het nog steeds niet werkt:**

1. **Check deze URLs:**
   - Vercel Dashboard: https://vercel.com/blaze-wallets-projects
   - Admin Settings: https://vercel.com/blaze-wallets-projects/admin/settings
   - Latest Deployment: https://vercel.com/blaze-wallets-projects/admin

2. **Deployment logs bekijken:**
   - Copy laatste error uit logs
   - Google de error message
   - Check Next.js docs

3. **Vercel Support:**
   - Als het echt niet lukt: https://vercel.com/support

---

## 🎉 VERWACHT RESULTAAT

Na correct configureren:

✅ **Auto-deployment:**
- Push naar GitHub → Vercel detecteert → Builds → Deployt
- Main wallet: https://blazewallet.io
- Admin panel: https://admin.blazewallet.io

✅ **Functionaliteit:**
- Admin login werkt
- Users tab toont alle users
- Search & filter werken
- User details pagina's laden
- Balance viewer werkt
- Portfolio USD waarden tonen
- Transaction history zichtbaar

---

## ✅ QUICK CHECK

**Is admin live?**
```bash
curl -I https://admin.blazewallet.io
# Should return: HTTP/2 200
```

**Kan je inloggen?**
1. Visit: https://admin.blazewallet.io/login
2. Login met admin credentials
3. Should redirect to: https://admin.blazewallet.io (dashboard)

**Werken de APIs?**
```bash
# After login, check browser console:
# Network tab should show:
# GET /api/admin/analytics/overview → 200 OK
# GET /api/admin/users → 200 OK
```

---

## 📚 RESOURCES

- **Vercel Monorepo Guide**: https://vercel.com/docs/concepts/monorepos
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Vercel CLI**: https://vercel.com/docs/cli

---

## 🎯 SUMMARY

**Probleem:** Admin deployt niet (monorepo)  
**Oplossing:** Pas Vercel build settings aan  
**Tijd:** 2-3 minuten  
**Result:** Auto-deploy vanaf GitHub werkt  

**Volg OPTIE 1 hierboven voor de snelste fix! ⭐**

---

**Made with 💙 for BLAZE Wallet**  
*Complete Deployment Guide*

