# 🚀 ONRAMPER SETUP GUIDE

## ✅ Implementatie Status

**100% COMPLEET** - Alle code is geïmplementeerd en klaar voor gebruik!

Je hoeft alleen nog maar de **API key** toe te voegen en het werkt direct.

---

## 🔑 STAP 1: API Key Verkrijgen

### Via Onramper Dashboard:
1. Ga naar: https://dashboard.onramper.com/
2. Maak een account aan (of log in)
3. Ga naar **Settings** → **API Keys**
4. Klik op **"Create API Key"**
5. Kopieer je API key (je ziet hem maar 1x!)

### Via Onramper Sales Team:
- Email: sales@onramper.com
- Vraag om een API key voor productie gebruik
- Ze helpen je ook met webhook setup

---

## 🔧 STAP 2: Environment Variables Toevoegen

### **Voor Vercel (Production):**

1. Ga naar: https://vercel.com/your-project/settings/environment-variables
2. Klik op **"Add New"**
3. Voeg toe:

```bash
# Onramper API Key (VERPLICHT)
ONRAMPER_API_KEY=your_api_key_here

# Onramper Environment (optioneel, default: production)
ONRAMPER_ENVIRONMENT=production  # of 'sandbox' voor testing

# Webhook Secret (optioneel, voor webhook validatie)
ONRAMPER_WEBHOOK_SECRET=your_webhook_secret_here
```

4. Selecteer environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

5. Klik **"Save"**

### **Voor Local Development (.env.local):**

Maak of update `.env.local` in de project root:

```bash
# Onramper API Key
ONRAMPER_API_KEY=your_api_key_here

# Use sandbox for local testing
ONRAMPER_ENVIRONMENT=sandbox

# Webhook Secret (optioneel)
ONRAMPER_WEBHOOK_SECRET=your_webhook_secret_here
```

---

## 🔔 STAP 3: Webhook Setup (Optioneel maar Aanbevolen)

### **1. Configureer Webhook URL in Onramper Dashboard:**

1. Ga naar: https://dashboard.onramper.com/
2. Ga naar **Settings** → **Webhooks**
3. Klik op **"Add Webhook"**
4. Voeg toe:
   - **URL**: `https://your-domain.com/api/onramper/webhook`
   - **Events**: Selecteer alle events (PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED)
5. Kopieer de **Webhook Secret**
6. Voeg toe aan environment variables: `ONRAMPER_WEBHOOK_SECRET`

### **2. Webhook Events:**

De webhook handler ontvangt deze events:
- `PENDING` - Transactie gestart
- `PROCESSING` - Betaling ontvangen, crypto wordt verzonden
- `COMPLETED` - Crypto succesvol verzonden
- `FAILED` - Transactie gefaald
- `REFUNDED` - Terugbetaling uitgevoerd
- `CANCELLED` - Transactie geannuleerd

---

## 🧪 STAP 4: Testen

### **1. Local Testing:**

```bash
# Start development server
npm run dev

# Open http://localhost:3000
# Klik op "Buy" button
# Widget zou moeten laden
```

### **2. Sandbox Testing:**

Voor testing gebruik je de sandbox environment:
- Set `ONRAMPER_ENVIRONMENT=sandbox`
- Gebruik sandbox API key (verkrijgbaar via dashboard)
- Test met kleine bedragen

### **3. Production Testing:**

- Zorg dat `ONRAMPER_ENVIRONMENT=production` (of niet ingesteld)
- Gebruik productie API key
- Test met kleine bedragen eerst

---

## 📁 Geïmplementeerde Bestanden

### **1. Service Class:**
- `lib/onramper-service.ts` - Onramper service met alle helper methods

### **2. API Routes:**
- `app/api/onramper/init/route.ts` - Widget initialization (server-side)
- `app/api/onramper/webhook/route.ts` - Webhook handler

### **3. Components:**
- `components/BuyModal.tsx` - Updated met Onramper iFrame embed

### **4. Documentation:**
- `ONRAMPER_IMPLEMENTATION_PLAN.md` - Volledige implementatie plan
- `ONRAMPER_SETUP.md` - Deze setup guide

---

## 🎯 Features

### **✅ Geïmplementeerd:**

1. **Widget Integration**
   - iFrame embed voor naadloze UX
   - Responsive design (mobile + desktop)
   - Loading states
   - Error handling

2. **Multi-Chain Support**
   - Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche, Solana
   - Automatische wallet address mapping
   - Chain-specific default crypto

3. **Security**
   - API key alleen server-side
   - Webhook signature validatie
   - Input validatie

4. **User Experience**
   - Popular crypto selector
   - Payment methods display
   - Smooth animations
   - Clear error messages

---

## 🔍 Troubleshooting

### **Widget laadt niet:**

1. Check of `ONRAMPER_API_KEY` is ingesteld
2. Check browser console voor errors
3. Check Vercel logs voor API errors
4. Verify API key is correct

### **Webhook werkt niet:**

1. Check of `ONRAMPER_WEBHOOK_SECRET` is ingesteld
2. Verify webhook URL is correct in Onramper dashboard
3. Check Vercel logs voor webhook errors
4. Test webhook met Onramper test tool

### **"Onramper not configured" error:**

1. Add `ONRAMPER_API_KEY` to environment variables
2. Redeploy application
3. Restart development server (local)

---

## 📊 Monitoring

### **Check Logs:**

```bash
# Vercel Logs
vercel logs

# Local Logs
# Check terminal waar npm run dev draait
```

### **Key Log Messages:**

- `✅ Onramper widget URL generated` - Success
- `❌ Onramper init error` - Error
- `🔔 Onramper webhook received` - Webhook received
- `⚠️ Onramper API key not configured` - Missing API key

---

## 🚀 Deployment

### **Na API Key Setup:**

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "feat: Add Onramper integration"
   git push origin main
   ```

2. **Vercel auto-deploys** (als connected)

3. **Verify deployment:**
   - Check Vercel dashboard
   - Test buy flow
   - Check logs voor errors

---

## 📚 Resources

### **Documentation:**
- Onramper Docs: https://docs.onramper.com/
- Integration Guide: https://docs.onramper.com/docs/integration-steps
- Widget Docs: https://docs.onramper.com/docs/widget
- Webhook Docs: https://docs.onramper.com/docs/webhooks

### **Support:**
- Onramper Support: support@onramper.com
- Onramper Sales: sales@onramper.com
- Dashboard: https://dashboard.onramper.com/

---

## ✅ Checklist

- [ ] API key verkregen van Onramper
- [ ] `ONRAMPER_API_KEY` toegevoegd aan Vercel
- [ ] `ONRAMPER_API_KEY` toegevoegd aan `.env.local` (local)
- [ ] Webhook URL geconfigureerd in Onramper dashboard (optioneel)
- [ ] `ONRAMPER_WEBHOOK_SECRET` toegevoegd (optioneel)
- [ ] Local testing voltooid
- [ ] Production deployment voltooid
- [ ] Buy flow getest
- [ ] Webhook events getest (optioneel)

---

**🎉 Klaar! Voeg alleen nog de API key toe en het werkt!**

