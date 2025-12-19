# 🔥 BLAZE WALLET - BUY FUNCTIONALITY VOORSTEL

**Datum:** 15 December 2025  
**Status:** 📋 **VOORSTEL VOOR HERZIENING**

---

## 🎯 PROBLEEM MET HUIDIGE IMPLEMENTATIE

### Huidige situatie (Onramper):
- ❌ **Popups van verschillende providers** - Gebruiker wordt naar externe sites gestuurd
- ❌ **Herhaalde KYC** - Elke provider vraagt opnieuw om identificatie
- ❌ **Slechte UX** - Niet naadloos binnen Blaze UI
- ❌ **Complexe flow** - Meerdere stappen, verschillende providers
- ❌ **Wallet adres moet handmatig** - Zelfs al sturen we het mee

---

## ✅ VOORGESTELDE OPLOSSING

### **Optie 1: MoonPay Embedded Widget** ⭐ **AANBEVOLEN**

#### Waarom MoonPay?
- ✅ **Volledig embedded** - Geen popups, alles binnen Blaze UI
- ✅ **Wereldwijde dekking** - 160+ landen, 50+ fiat currencies
- ✅ **Multi-chain support** - Solana, Ethereum, Polygon, BSC, etc.
- ✅ **Goede UX** - Moderne, snelle checkout flow
- ✅ **KYC wordt onthouden** - Gebruiker hoeft niet elke keer opnieuw te verifiëren
- ✅ **Automatisch wallet adres** - Wordt automatisch ingevuld
- ✅ **Direct API** - Geen aggregator, directe integratie
- ✅ **Betrouwbaar** - Gebruikt door Trust Wallet, MetaMask, en vele anderen

#### Technische implementatie:
```typescript
// MoonPay biedt een embedded iframe widget
// Alles gebeurt binnen onze eigen modal
// Geen popups, geen redirects

<iframe
  src={`https://buy.moonpay.com/?apiKey=${MOONPAY_API_KEY}&currencyCode=${crypto}&walletAddress=${walletAddress}&baseCurrencyCode=${fiat}&baseCurrencyAmount=${amount}`}
  className="w-full h-[600px] border-0 rounded-xl"
/>
```

#### Features:
- **Embedded iframe** - Volledig binnen Blaze modal
- **Auto wallet address** - Wordt automatisch ingevuld
- **Real-time quotes** - Live exchange rates
- **Payment methods** - Credit card, bank transfer, Apple Pay, Google Pay
- **KYC onthouden** - Na eerste keer niet meer nodig
- **Transaction tracking** - Real-time status updates via webhooks

#### Kosten:
- **Transactie fee**: ~4.5% (vergelijkbaar met Onramper)
- **Geen maandelijkse kosten**
- **Geen setup fees**

---

### **Optie 2: Ramp Network Embedded Widget**

#### Waarom Ramp?
- ✅ **Volledig embedded** - Geen popups
- ✅ **Goede UX** - Snelle checkout
- ✅ **Multi-chain** - Solana, Ethereum, Polygon, etc.
- ✅ **KYC onthouden** - Na eerste keer niet meer nodig
- ✅ **Direct API** - Geen aggregator

#### Nadelen vs MoonPay:
- ⚠️ **Minder wereldwijde dekking** - Minder landen dan MoonPay
- ⚠️ **Minder payment methods** - Minder opties dan MoonPay

---

### **Optie 3: Transak Embedded Widget**

#### Waarom Transak?
- ✅ **Volledig embedded**
- ✅ **Multi-chain support**
- ✅ **Goede API**

#### Nadelen:
- ⚠️ **Minder bekend** - Minder vertrouwd door gebruikers
- ⚠️ **Minder wereldwijde dekking** - Minder landen

---

## 🏆 AANBEVELING: **MOONPAY**

### Redenen:
1. **Beste embedded widget** - Volledig naadloos binnen Blaze UI
2. **Wereldwijde dekking** - 160+ landen, 50+ fiat currencies
3. **Betrouwbaar** - Gebruikt door grote wallets (Trust Wallet, MetaMask)
4. **Goede UX** - Moderne, snelle checkout
5. **KYC onthouden** - Gebruiker hoeft niet elke keer opnieuw te verifiëren
6. **Automatisch wallet adres** - Wordt automatisch ingevuld
7. **Direct API** - Geen aggregator, directe integratie
8. **Goede documentatie** - Uitgebreide docs en support

---

## 🏗️ IMPLEMENTATIE PLAN

### Stap 1: MoonPay Account Setup
1. Account aanmaken bij MoonPay
2. API keys ophalen (Public Key voor frontend, Secret Key voor backend)
3. Webhook URL configureren
4. Test mode activeren voor development

### Stap 2: Code Implementatie

#### A. Nieuwe MoonPay Service (`lib/moonpay-service.ts`)
```typescript
export class MoonPayService {
  static getSupportedCryptos(chainId: number): string[] {
    // Return supported crypto codes for chain
  }
  
  static getWidgetUrl(params: {
    crypto: string;
    fiat: string;
    amount: number;
    walletAddress: string;
  }): string {
    // Build MoonPay widget URL
  }
  
  static async getQuote(params: {
    crypto: string;
    fiat: string;
    amount: number;
  }): Promise<Quote> {
    // Fetch quote from MoonPay API
  }
}
```

#### B. Nieuwe BuyModal (`components/BuyModal.tsx`)
```typescript
// Volledig nieuwe implementatie met MoonPay embedded widget
// Geen popups, alles binnen Blaze modal
// Stappen:
// 1. Select amount, crypto, fiat
// 2. Show MoonPay embedded iframe
// 3. Handle completion via webhook
```

#### C. API Routes
- `/api/moonpay/quote` - Get real-time quotes
- `/api/moonpay/webhook` - Handle transaction status updates

### Stap 3: UI/UX
- **Volledig binnen Blaze modal** - Geen popups
- **Embedded iframe** - MoonPay widget binnen onze modal
- **Blaze styling** - Consistent met rest van app
- **Loading states** - Smooth UX
- **Error handling** - Duidelijke foutmeldingen

---

## 📊 VERGELIJKING

| Feature | Onramper (Huidig) | MoonPay (Voorstel) | Ramp | Transak |
|---------|------------------|-------------------|------|---------|
| **Embedded Widget** | ❌ Popup | ✅ Iframe | ✅ Iframe | ✅ Iframe |
| **KYC Onthouden** | ❌ Elke keer | ✅ Na eerste keer | ✅ Na eerste keer | ✅ Na eerste keer |
| **Auto Wallet Adres** | ⚠️ Soms | ✅ Altijd | ✅ Altijd | ✅ Altijd |
| **Wereldwijde Dekking** | ✅ 180+ landen | ✅ 160+ landen | ⚠️ 100+ landen | ⚠️ 100+ landen |
| **Payment Methods** | ✅ Veel | ✅ Veel | ⚠️ Minder | ⚠️ Minder |
| **Betrouwbaarheid** | ✅ Goed | ✅ Zeer goed | ✅ Goed | ⚠️ Minder bekend |
| **UX** | ❌ Popups | ✅ Embedded | ✅ Embedded | ✅ Embedded |
| **Kosten** | ~4.5% | ~4.5% | ~4.5% | ~4.5% |

---

## 🚀 VOLGENDE STAPPEN

1. **Beslissing** - Kies MoonPay of alternatief
2. **MoonPay Account** - Account aanmaken en API keys ophalen
3. **Implementatie** - Nieuwe BuyModal met embedded widget
4. **Testing** - Testen in sandbox mode
5. **Deployment** - Live zetten in production

---

## 💡 CONCLUSIE

**MoonPay is de beste keuze** voor een naadloze buy functionaliteit binnen Blaze Wallet:
- ✅ Volledig embedded (geen popups)
- ✅ KYC wordt onthouden
- ✅ Automatisch wallet adres
- ✅ Wereldwijde dekking
- ✅ Betrouwbaar en bekend
- ✅ Goede UX

**Dit lost alle problemen op:**
- ❌ Geen popups meer
- ❌ Geen herhaalde KYC
- ❌ Alles binnen Blaze UI
- ❌ Automatisch wallet adres

---

*Voorstel opgesteld: 15 December 2025*

