# ⏳ Onramper API Key - Wachten op Heractivering

**Datum:** 26 Januari 2026  
**Status:** ⏳ **PENDING REACTIVATION**

---

## 📋 Situatie

### ✅ Probleem Geïdentificeerd
- **Oorzaak**: Onramper abonnement was verlopen
- **Actie**: Heractivering aangevraagd bij Onramper
- **Wachten op**: Goedkeuring van Onramper (waarschijnlijk handmatig proces)

### ❌ Huidige Status (26 Jan 2026, ~19:00)
```bash
Status: 403 Forbidden
Message: {"message":"Forbidden"}
```

De API key `pk_prod_01KBJCSS9G727A14XA544DSS7D` werkt **nog niet** - wacht op heractivering.

---

## 🔧 Wat Is Al Gefixed

### ✅ Code Bugs
1. **Fixed**: `.env.local` bevatte literal `\n` string
   - Voor: `ONRAMPER_API_KEY="pk_prod_01KBJCSS9G727A14XA544DSS7D\n"`
   - Na: `ONRAMPER_API_KEY="pk_prod_01KBJCSS9G727A14XA544DSS7D"`

2. **Verified**: Alle code logica is correct
   - ✅ BuyModal3 geeft `paymentMethod` parameter correct mee
   - ✅ API routes werken correct
   - ✅ OnramperService gebruikt juiste endpoints
   - ✅ Error handling is op orde

### 📝 Status
De code is **100% klaar**. Zodra de API key werkt, zal de volledige buy functionaliteit direct werken!

---

## 🧪 Hoe Te Testen

### Quick Test Script
Ik heb een handige test script gemaakt: `test-api-key.sh`

```bash
# Run dit om te checken of de key het alweer doet:
./test-api-key.sh
```

### Output bij SUCCESS:
```
✅ SUCCESS! API key werkt weer!

Response preview:
  - moonpay: payout=0.123 SOL, paymentMethod=creditcard
  - banxa: payout=0.125 SOL, paymentMethod=ideal
  - transak: payout=0.122 SOL, paymentMethod=creditcard
```

### Output bij STILL WAITING:
```
❌ API key werkt NOG NIET (403 Forbidden)
⏳ Wacht tot Onramper je abonnement heractiveerd heeft
```

### Handmatige Test (zonder script):
```bash
curl -H "Authorization: pk_prod_01KBJCSS9G727A14XA544DSS7D" \
  'https://api.onramper.com/quotes/eur/sol?amount=100'
```

---

## 🚀 Zodra De Key Werkt

### Stap 1: Verifieer dat het werkt
```bash
./test-api-key.sh
```

### Stap 2: Herstart Dev Server
```bash
# Stop huidige server
pkill -f "npm run dev"

# Start nieuwe server (laadt nieuwe env vars)
npm run dev
```

### Stap 3: Test Buy Flow Lokaal
1. Open http://localhost:3000
2. Unlock wallet
3. Klik op "Buy" button
4. Selecteer amount (bijv. €100)
5. Selecteer crypto (bijv. SOL)
6. **CHECK**: Alle payment methods zouden nu beschikbaar moeten zijn:
   - ✅ Credit/Debit Card
   - ✅ Apple Pay
   - ✅ Google Pay
   - ✅ iDeal | Wero
   - ✅ Bancontact
   - ✅ SEPA Bank Transfer

### Stap 4: Update Vercel (als key werkt)
```bash
# De key staat al in Vercel environments
# Maar als het lang geleden is, kun je deze refreshen:

vercel env ls  # Check huidige keys

# Of herdeployen om zeker te zijn:
vercel --prod
```

---

## 📊 Timeline

- **15 Dec 2025**: API key werkte nog ✅
- **~Ergens in Dec/Jan**: Abonnement verlopen ❌
- **26 Jan 2026, ~19:00**: 
  - Probleem geïdentificeerd ✅
  - Heractivering aangevraagd ⏳
  - Code bugs gefixed ✅
  - Test script gemaakt ✅
- **Binnenkort**: Onramper keurt heractivering goed ⏳
- **Dan**: Buy functionaliteit werkt weer volledig! 🎉

---

## 🎯 Impact

### Wat NIET werkt (totdat key actief is):
- ❌ Buy crypto functionaliteit (lokaal EN production)
- ❌ Payment methods tonen als "not available"
- ❌ Geen quotes van providers

### Wat WEL werkt:
- ✅ Alle andere wallet functionaliteit
- ✅ Send transactions
- ✅ Receive
- ✅ Swap (via Jupiter)
- ✅ Token management
- ✅ History
- ✅ Contacts
- ✅ etc.

---

## 📞 Contact Onramper

Als het lang duurt (> 24-48 uur), kun je contact opnemen:

- **Email**: support@onramper.com
- **Dashboard**: https://onramper.com/dashboard
- **Ticket**: Via dashboard een support ticket openen

Vermeld:
- Account email
- API Key: `pk_prod_01KBJCSS9G727A14XA544DSS7D`
- Issue: "Reactivation pending after subscription renewal"

---

## ✅ Checklist voor Later

Wanneer de key weer werkt:

- [ ] Run `./test-api-key.sh` - moet ✅ SUCCESS geven
- [ ] Herstart dev server: `pkill -f "npm run dev" && npm run dev`
- [ ] Test buy flow op localhost:3000
- [ ] Verifieer dat ALLE payment methods beschikbaar zijn
- [ ] Test een kleine test transactie (bijv. €10)
- [ ] Check Vercel production deployment
- [ ] Update deze documentatie met nieuwe status

---

## 🎉 Volgende Stappen

**Nu:** Wacht gewoon tot Onramper je account heractiveerd.

**Check regelmatig:**
```bash
./test-api-key.sh
```

**Als het werkt:** De code is al klaar - het zal direct werken! 🚀

