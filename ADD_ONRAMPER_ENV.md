# 🔑 Onramper Environment Variables Toevoegen

## ✅ Project Status

**Project gelinkt:** ✅ `blaze-wallet` is succesvol gelinkt aan Vercel

## 📝 Stappen om Environment Variables Toe te Voegen

### **Optie 1: Via Vercel CLI (Interactief)**

Zodra je de Onramper API key hebt, voer dit uit:

```bash
# Navigate to project
cd "/Users/rickschlimback/Desktop/BlazeWallet 13-11"

# Add API key voor alle environments
echo "YOUR_API_KEY_HERE" | vercel env add ONRAMPER_API_KEY production
echo "YOUR_API_KEY_HERE" | vercel env add ONRAMPER_API_KEY preview
echo "YOUR_API_KEY_HERE" | vercel env add ONRAMPER_API_KEY development

# Add environment setting (sandbox of production)
echo "production" | vercel env add ONRAMPER_ENVIRONMENT production
echo "production" | vercel env add ONRAMPER_ENVIRONMENT preview
echo "production" | vercel env add ONRAMPER_ENVIRONMENT development
```

**Of gebruik het script:**
```bash
./scripts/add-onramper-env.sh
```

### **Optie 2: Via Vercel Dashboard**

1. Ga naar: https://vercel.com/blaze-wallets-projects/blaze-wallet/settings/environment-variables
2. Klik op **"Add New"**
3. Voeg toe:
   - **Name:** `ONRAMPER_API_KEY`
   - **Value:** Je Onramper API key
   - **Environments:** ✅ Production ✅ Preview ✅ Development
4. Klik **"Save"**
5. Herhaal voor `ONRAMPER_ENVIRONMENT`:
   - **Name:** `ONRAMPER_ENVIRONMENT`
   - **Value:** `production` (of `sandbox` voor testing)
   - **Environments:** ✅ Production ✅ Preview ✅ Development

### **Optie 3: Via Script (Automatisch)**

```bash
# Run het script (vraagt om API key)
./scripts/add-onramper-env.sh

# Of met API key als argument
./scripts/add-onramper-env.sh YOUR_API_KEY_HERE
```

## ✅ Verificatie

Na het toevoegen, check of het werkt:

```bash
vercel env ls | grep ONRAMPER
```

Je zou moeten zien:
```
ONRAMPER_API_KEY        Encrypted    Production,Preview,Development
ONRAMPER_ENVIRONMENT    Encrypted    Production,Preview,Development
```

## 🚀 Na Toevoegen

1. **Redeploy** de applicatie (automatisch via Git push, of handmatig via Vercel dashboard)
2. **Test** de buy flow
3. **Check logs** voor eventuele errors

## 📝 Notities

- **API Key:** Verkrijg via https://dashboard.onramper.com/ of sales@onramper.com
- **Environment:** Gebruik `sandbox` voor testing, `production` voor live
- **Webhook Secret:** (Optioneel) Voeg later toe als `ONRAMPER_WEBHOOK_SECRET`

