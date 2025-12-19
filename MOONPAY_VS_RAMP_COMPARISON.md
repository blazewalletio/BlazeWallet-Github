# 🎯 MoonPay vs Ramp Network - Beslissing voor Blaze Wallet

**Datum:** 19 December 2025  
**Doel:** Weloverwogen keuze tussen MoonPay en Ramp Network voor embedded on-ramp

---

## 📊 Kritieke Factoren voor Blaze Wallet

### **Eis: Volledig embedded UI/UX binnen Blaze, GEEN popups**

---

## 🔴 MoonPay - Huidige Status

### ✅ **Wat Werkt:**
- React SDK met embedded widget (`@moonpay/moonpay-react`)
- Code is geïmplementeerd en getest
- Wereldwijde dekking (160+ landen)
- Grote naam, betrouwbaar

### ❌ **Kritieke Problemen:**
1. **Account Activatie Blokkeert Alles**
   - Error: "On-Ramp is not yet enabled for live use"
   - Account is nog niet geactiveerd voor productie
   - Geen tijdlijn wanneer dit opgelost wordt

2. **Support is Onbereikbaar**
   - `support@moonpay.com` → Automatische reply: "unmanaged email address"
   - Support portal geeft geen hulp
   - Geen directe contactmethode
   - Geen tijdlijn voor account activatie

3. **Technische Issues Gehad:**
   - CSP blocking issues (opgelost, maar wel problemen gehad)
   - API endpoint issues (v2 vs v3, opgelost)
   - Veel tijd gestoken in troubleshooting

4. **Fees:**
   - Tot 4.5% voor credit cards
   - Minimum $3.99 per transactie
   - Minder transparant

5. **Token/Chain Support:**
   - 80-170 tokens (afhankelijk van regio)
   - Beperktere blockchain ondersteuning

### ⚠️ **Risico's:**
- **Onbekende wachttijd** voor account activatie
- **Geen garantie** dat account wordt geactiveerd
- **Support moeilijk** te bereiken als er problemen zijn
- **Al veel tijd verloren** aan implementatie die nog niet werkt

---

## 🟢 Ramp Network - Potentiële Status

### ✅ **Voordelen:**
1. **Uitstekende Embedded UX**
   - Bekend om beste embedded widget experience
   - Volledig binnen app, geen popups
   - Modern, gebruiksvriendelijke UI
   - Native Apple Pay / Google Pay support

2. **Betere Fees:**
   - 1.99% - 3.9% (lager dan MoonPay)
   - Transparante pricing
   - Geen verborgen kosten

3. **Meer Support:**
   - 1500+ tokens (vs 80-170 bij MoonPay)
   - 60+ blockchains (vs beperkter bij MoonPay)
   - Betere multi-chain support

4. **Betere Developer Experience:**
   - Goede documentatie
   - Actieve community
   - Betere support (lijkt beter georganiseerd)

5. **React SDK:**
   - Officiële `@ramp-network/react` package
   - Embedded variant werkt uitstekend
   - Goed onderhouden

### ⚠️ **Nadelen:**
- Nog geen account (maar we zijn bezig met aanmelding)
- Mogelijk iets duurder dan MoonPay (maar transparanter)
- Onbekende onboarding tijdlijn (maar lijkt beter georganiseerd)

---

## 🎯 **Mijn Aanbeveling: Ramp Network** ⭐⭐⭐⭐⭐

### **Waarom Ramp Network voor Blaze Wallet:**

#### 1. **Embedded UX is Kritiek** 🔴
- **Ramp:** Bekend om **beste embedded widget** in de industrie
- **MoonPay:** Werkt, maar we hebben al problemen gehad
- **Voor Blaze:** Embedded UX is je #1 eis → Ramp is beter

#### 2. **Account Activatie** 🔴
- **Ramp:** Account aanmelding is in progress, lijkt beter georganiseerd
- **MoonPay:** Account is **GEBLOKKEERD**, geen tijdlijn, support onbereikbaar
- **Voor Blaze:** Je wilt NU live gaan → Ramp heeft betere kans

#### 3. **Support & Communicatie** 🔴
- **Ramp:** Lijkt beter georganiseerd, duidelijke contactmethoden
- **MoonPay:** Support is **ONBEREIKBAAR**, frustrerend
- **Voor Blaze:** Als er problemen zijn, wil je hulp → Ramp is beter

#### 4. **Fees & Transparantie** 🟡
- **Ramp:** 1.99% - 3.9%, transparant
- **MoonPay:** Tot 4.5%, minder transparant
- **Voor Blaze:** Lagere fees = betere UX voor gebruikers → Ramp is beter

#### 5. **Token/Chain Support** 🟡
- **Ramp:** 1500+ tokens, 60+ chains
- **MoonPay:** 80-170 tokens, beperkter
- **Voor Blaze:** Meer support = betere flexibiliteit → Ramp is beter

#### 6. **Developer Experience** 🟡
- **Ramp:** Goede docs, actieve community
- **MoonPay:** We hebben al veel problemen gehad
- **Voor Blaze:** Minder tijd verspillen aan troubleshooting → Ramp is beter

---

## 📋 **Conclusie**

### **Voor Blaze Wallet specifiek (embedded UI/UX, geen popups):**

**Kies voor Ramp Network** omdat:

1. ✅ **Beste embedded UX** - Dit is je #1 eis
2. ✅ **Account activatie** - Betere kans dat het snel werkt
3. ✅ **Support** - Bereikbaar als je hulp nodig hebt
4. ✅ **Fees** - Lager en transparanter
5. ✅ **Support** - Meer tokens/chains = flexibeler
6. ✅ **Developer experience** - Minder problemen, sneller live

### **MoonPay Alleen Als:**
- Ramp account activatie faalt
- Je specifiek MoonPay features nodig hebt die Ramp niet heeft
- Je bereid bent te wachten op account activatie (onbekende tijd)

---

## 🚀 **Aanbevolen Actie Plan**

### **Optie 1: Ramp Network (Aanbevolen)** ⭐
1. ✅ Wacht op Ramp account goedkeuring
2. ✅ Implementeer Ramp React SDK
3. ✅ Test embedded widget
4. ✅ Go live met Ramp

**Tijdlijn:** 1-2 weken (afhankelijk van account goedkeuring)

### **Optie 2: MoonPay (Fallback)**
1. ⏳ Wacht op account activatie (onbekende tijd)
2. ⏳ Blijf proberen support te bereiken
3. ⏳ Test als account geactiveerd is
4. ⏳ Go live met MoonPay

**Tijdlijn:** Onbekend (kan weken/maanden duren)

### **Optie 3: Beide (Dual Integration)**
1. ✅ Implementeer Ramp als primaire provider
2. ⏳ Houd MoonPay als fallback (als account geactiveerd wordt)
3. ✅ Gebruikers kunnen kiezen tussen providers

**Tijdlijn:** 2-3 weken (meer werk, maar flexibeler)

---

## 💡 **Mijn Advies**

**Start met Ramp Network** omdat:
- Je **NU** een werkende oplossing nodig hebt
- Embedded UX is je #1 prioriteit → Ramp is beter
- Support is belangrijk → Ramp is bereikbaarder
- Fees zijn lager → Betere UX voor gebruikers

**Houd MoonPay als backup** voor later, maar focus eerst op Ramp.

---

*Laatste update: 19 December 2025*

