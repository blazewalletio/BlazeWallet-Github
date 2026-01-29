# ⚠️ VERCEL ADMIN DEPLOYMENT - MANUAL CONFIGURATIE VEREIST

## 🔍 HET PROBLEEM

De admin app kan niet builden op Vercel omdat:
- Admin zit in `apps/admin/`
- Admin gebruikt `lib/` folder uit root
- Vercel isoleert de admin en heeft geen toegang tot `../lib/`

## ✅ OPLOSSING: VERCEL SETTINGS AANPASSEN

### **Stap 1: Open Vercel Dashboard**
```
https://vercel.com/blaze-wallets-projects/admin/settings
```

### **Stap 2: Scroll naar "Build & Development Settings"**
Klik op "Edit" of "Override"

### **Stap 3: Pas de volgende instellingen aan:**

#### **Root Directory:**
```
(LEEG LATEN - verwijder apps/admin als die er staat)
```

#### **Framework Preset:**
```
Next.js
```

#### **Install Command:** (Override)
```bash
npm install && cd apps/admin && npm install
```

#### **Build Command:** (Override)
```bash
cd apps/admin && npm run build
```

#### **Output Directory:**
```
apps/admin/.next
```

### **Stap 4: Environment Variables**
Verify dat deze aanwezig zijn:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### **Stap 5: Save & Redeploy**
1. Scroll naar beneden
2. Klik "Save"
3. Ga naar "Deployments" tab
4. Klik op laatste deployment
5. Klik "..." menu → "Redeploy"

---

## 🎯 WAAROM DEZE CONFIGURATIE?

```bash
# Deze configuratie:
1. npm install                    # Installeert root dependencies (inclusief lib/)
2. cd apps/admin                   # Ga naar admin folder
3. npm install                     # Installeert admin dependencies
4. npm run build                   # Build admin (heeft nu toegang tot ../lib/)
```

**Result:** Admin kan `../../lib/` importeren tijdens build!

---

## ✅ VERWACHT RESULTAAT

Na deze configuratie:
- ✅ Build slaagt op Vercel
- ✅ Admin deployt naar https://admin.blazewallet.io
- ✅ Auto-deployment werkt vanaf GitHub
- ✅ Alle features werkend

---

## 🐛 ALS HET NOG NIET WERKT

### **Optie 1: Clear Build Cache**
In Vercel dashboard:
1. Settings → Advanced
2. Scroll naar "Build Cache"
3. Klik "Clear Build Cache"
4. Redeploy

### **Optie 2: Verwijder en Hermaak Project**
1. Delete admin project in Vercel
2. Maak nieuw project:
   - Kies repository: `BlazeWallet21-10`
   - Framework: Next.js
   - **Root Directory: (leeg laten!)**
   - Configure zoals boven beschreven
3. Deploy

---

## 📸 SCREENSHOTS VAN JUISTE CONFIGURATIE

```
Build & Development Settings
├─ Framework Preset: Next.js
├─ Root Directory: [empty]
├─ Install Command: npm install && cd apps/admin && npm install
├─ Build Command: cd apps/admin && npm run build
└─ Output Directory: apps/admin/.next
```

---

## ✅ CHECKLIST

- [ ] Vercel dashboard geopend
- [ ] Build settings aangepast
- [ ] Root directory leeg gelaten
- [ ] Install command: `npm install && cd apps/admin && npm install`
- [ ] Build command: `cd apps/admin && npm run build`
- [ ] Output directory: `apps/admin/.next`
- [ ] Environment variables gecheckt
- [ ] Saved
- [ ] Redeployed
- [ ] Admin live op https://admin.blazewallet.io

---

## 🎊 NA SUCCESVOLLE DEPLOYMENT

Test de volgende features:
1. ✅ Login werkt
2. ✅ Dashboard laadt
3. ✅ Users tab toont users
4. ✅ Search functie werkt
5. ✅ User detail page laadt
6. ✅ "View Balances" werkt
7. ✅ Portfolio USD waarden tonen
8. ✅ Transaction history zichtbaar

---

**DIT IS EEN 1x HANDMATIGE ACTIE**
Na deze configuratie deployt admin automatisch bij elke GitHub push! 🚀

