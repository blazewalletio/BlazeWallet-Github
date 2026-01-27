# 🔴 KRITIEK: Onramper API Key Werkt Niet Meer

**Datum:** 26 Januari 2026  
**Status:** ❌ **NIET WERKEND** (403 Forbidden)

---

## 📍 Waar de key staat

### ✅ Lokaal (Development)
```
.env.local:
ONRAMPER_API_KEY="pk_prod_01KBJCSS9G727A14XA544DSS7D"
```

### ✅ Vercel (Production/Preview/Development)
Volgens documentatie staat dezelfde key in alle Vercel environments:
- **Production**: `pk_prod_01KBJCSS9G727A14XA544DSS7D`
- **Preview**: `pk_prod_01KBJCSS9G727A14XA544DSS7D`
- **Development**: `pk_prod_01KBJCSS9G727A14XA544DSS7D`

---

## ❌ Huidige Situatie

### Test Resultaat (26 Jan 2026):
```bash
$ curl -H "Authorization: pk_prod_01KBJCSS9G727A14XA544DSS7D" \
  'https://api.onramper.com/quotes/eur/sol?amount=100'

Response: {"message":"Forbidden"}
Status: 403 Forbidden
```

### Impact:
- ❌ **Lokale development**: Buy functionaliteit werkt NIET
- ❌ **Vercel production**: Buy functionaliteit werkt NIET (als deze key daar ook staat)
- ❌ **Alle payment methods**: Tonen als "not available"

---

## 📊 Historische Context

Volgens `ONRAMPER_SETUP_COMPLETE.md` (15 December 2025):
- ✅ De key werkte toen WEL
- ✅ Quote API: Succesvol
- ✅ Supported Data API: Succesvol
- ✅ Payment Types API: Succesvol

**Conclusie**: Er is iets gebeurd tussen **15 december 2025** en **26 januari 2026** waardoor de key is gedeactiveerd of expired.

---

## 🔧 Mogelijke Oorzaken

1. **API Key Expired**: Sommige API keys hebben een vervaldatum
2. **Account Issue**: Betalingsprobleem of account suspended
3. **Rate Limiting**: Te veel requests (maar dit geeft meestal 429, niet 403)
4. **Permission Changes**: Onramper heeft de permissions van de key gewijzigd
5. **Incorrect Key**: De key is ooit veranderd maar niet overal ge-update

---

## ✅ Actie Items

### Stap 1: Check Onramper Dashboard
1. Login op https://onramper.com/dashboard
2. Ga naar API Keys sectie
3. Check:
   - ✓ Is `pk_prod_01KBJCSS9G727A14XA544DSS7D` nog actief?
   - ✓ Wat is de status van de key?
   - ✓ Zijn er error messages?
   - ✓ Is er een nieuwere key beschikbaar?

### Stap 2: Test de Key in het Dashboard
Onramper dashboard heeft vaak een built-in API tester. Test de key daar direct.

### Stap 3: Vraag Support
Als de key niet meer werkt, neem contact op met Onramper support:
- Email: support@onramper.com
- Ticket via dashboard
- Vraag om een nieuwe production key

### Stap 4: Update Overal
Als je een nieuwe key krijgt, update deze op:
- ✅ `.env.local` (lokaal)
- ✅ Vercel Production environment
- ✅ Vercel Preview environment
- ✅ Vercel Development environment

**Commando voor Vercel update:**
```bash
# Set voor alle environments
vercel env add ONRAMPER_API_KEY production
vercel env add ONRAMPER_API_KEY preview
vercel env add ONRAMPER_API_KEY development

# Dan opnieuw deployen
vercel --prod
```

---

## 🧪 Test Commands

### Test nieuwe key direct:
```bash
curl -H "Authorization: YOUR_NEW_KEY" \
  'https://api.onramper.com/quotes/eur/eth?amount=100'
```

### Expected success response:
```json
[
  {
    "rate": 2729.70,
    "payout": 0.036634,
    "ramp": "moonpay",
    "paymentMethod": "creditcard",
    ...
  }
]
```

### Test via lokale API:
```bash
# Start dev server
npm run dev

# Test endpoint
curl 'http://localhost:3000/api/onramper/quotes?fiatAmount=100&fiatCurrency=EUR&cryptoCurrency=ETH'
```

---

## 📝 Andere Keys (in .env.local)

Je hebt ook:
- `ONRAMPER_SECRET_KEY="01KBJCSS9GM6FTX4MADWT8684Z"`
- `ONRAMPER_WEBHOOK_SECRET="01KBJCSS9GPC19BV50GBBH98N2"`

**Check of deze ook ge-update moeten worden** als je een nieuwe account/key set krijgt.

---

## 🚨 Urgentie: HOOG

De buy functionaliteit is **volledig down** totdat dit opgelost is. Gebruikers kunnen GEEN crypto kopen via de wallet.

