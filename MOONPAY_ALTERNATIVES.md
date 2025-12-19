# 🔄 MoonPay Alternatieven - On-Ramp Providers met React SDK

**Datum:** 19 December 2025  
**Doel:** Overzicht van alternatieve on-ramp providers met React SDK integratie

---

## 🏆 Top Alternatieven

### 1. **Ramp Network** ⭐⭐⭐⭐⭐
**Website:** https://ramp.network/  
**React SDK:** ✅ Ja - Officiële React SDK  
**Documentatie:** https://docs.ramp.network/

#### ✅ Voordelen:
- **Uitstekende UX** - Zeer gebruiksvriendelijk, moderne UI
- **React SDK** - Officiële `@ramp-network/react` package
- **Embedded Widget** - Volledig binnen je app, geen popups
- **Wereldwijde dekking** - 150+ landen
- **Multi-chain** - Ethereum, Polygon, Solana, Arbitrum, Optimism, Base, etc.
- **Betrouwbaar** - Grote naam in de industrie
- **Goede fees** - Competitieve tarieven
- **KYC onthouden** - Na eerste keer niet meer nodig
- **Apple Pay / Google Pay** - Native mobile payment support

#### ⚠️ Nadelen:
- Mogelijk iets duurder dan MoonPay
- Account setup kan tijd kosten

#### 💻 React Integratie:
```bash
npm install @ramp-network/react
```

```tsx
import { RampInstantSDK } from '@ramp-network/react';

<RampInstantSDK
  hostAppName="Blaze Wallet"
  hostLogoUrl="https://my.blazewallet.io/logo.png"
  variant="embedded"
  defaultAsset="ETH"
  defaultAmount="100"
  userAddress={walletAddress}
  onPurchaseCreated={(purchase) => {
    console.log('Purchase created:', purchase);
  }}
/>
```

---

### 2. **Transak** ⭐⭐⭐⭐
**Website:** https://transak.com/  
**React SDK:** ✅ Ja - Officiële React SDK  
**Documentatie:** https://docs.transak.com/

#### ✅ Voordelen:
- **React SDK** - Officiële `@transak/transak-sdk` package
- **Embedded Widget** - Volledig binnen je app
- **Wereldwijde dekking** - 150+ landen, 60+ fiat currencies
- **Multi-chain** - Alle grote chains
- **Veel payment methods** - Credit card, bank transfer, Apple Pay, Google Pay
- **Goede documentatie** - Uitgebreide docs
- **Actieve support** - Goede developer support

#### ⚠️ Nadelen:
- UI kan wat ouderwetser zijn dan Ramp
- Fees kunnen variëren per regio

#### 💻 React Integratie:
```bash
npm install @transak/transak-sdk
```

```tsx
import Transak from '@transak/transak-sdk';

const transak = new Transak({
  apiKey: 'YOUR_API_KEY',
  environment: 'PRODUCTION',
  widgetHeight: '600px',
  widgetWidth: '100%',
  defaultCryptoCurrency: 'ETH',
  defaultFiatCurrency: 'EUR',
  defaultFiatAmount: 100,
  walletAddress: walletAddress,
  themeColor: '#FF6B35', // Blaze orange
  hostURL: window.location.origin,
  redirectURL: window.location.origin,
});

transak.init();
```

---

### 3. **Onramper** ⭐⭐⭐
**Website:** https://onramper.com/  
**React SDK:** ✅ Ja - Officiële React SDK  
**Documentatie:** https://docs.onramper.com/

#### ✅ Voordelen:
- **Aggregator** - Toegang tot meerdere providers via één integratie
- **React SDK** - Officiële React component
- **Goede fees** - Vergelijkt automatisch beste prijzen
- **Multi-provider** - Gebruikers kunnen kiezen tussen providers
- **Flexibel** - Veel aanpassingsmogelijkheden

#### ⚠️ Nadelen:
- **Popups** - Gebruikt vaak popups (niet altijd embedded)
- **Complexer** - Meer providers = meer complexiteit
- **KYC per provider** - Gebruikers moeten mogelijk meerdere keren KYC doen

#### 💻 React Integratie:
```bash
npm install @onramper/react
```

```tsx
import { OnramperWidget } from '@onramper/react';

<OnramperWidget
  API_KEY="YOUR_API_KEY"
  defaultAmount={100}
  defaultCrypto="ETH"
  defaultFiat="EUR"
  walletAddress={walletAddress}
  isAddressEditable={false}
/>
```

**⚠️ Let op:** Je hebt Onramper al eerder gebruikt, maar vond je het niet ideaal vanwege popups en herhaalde KYC.

---

### 4. **Coinbase Pay** ⭐⭐⭐⭐
**Website:** https://www.coinbase.com/  
**React SDK:** ✅ Ja - Coinbase Pay SDK  
**Documentatie:** https://docs.cloud.coinbase.com/pay-sdk/docs

#### ✅ Voordelen:
- **Grote naam** - Zeer betrouwbaar (Coinbase)
- **React SDK** - Officiële SDK
- **Goede UX** - Modern en gebruiksvriendelijk
- **Wereldwijde dekking** - Via Coinbase infrastructuur
- **Multi-chain** - Alle grote chains

#### ⚠️ Nadelen:
- **Account vereist** - Gebruikers moeten Coinbase account hebben
- **Minder flexibel** - Minder aanpassingsmogelijkheden
- **Fees** - Kan duurder zijn

#### 💻 React Integratie:
```bash
npm install @coinbase/cbpay-js
```

```tsx
import { CoinbasePay } from '@coinbase/cbpay-js';

const coinbasePay = new CoinbasePay({
  appId: 'YOUR_APP_ID',
  destinationWallets: [{
    address: walletAddress,
    assets: ['ETH', 'USDC'],
    supportedNetworks: ['ethereum', 'polygon']
  }]
});

coinbasePay.render('coinbase-pay-button');
```

---

### 5. **Wyre** ⭐⭐⭐
**Website:** https://www.sendwyre.com/  
**React SDK:** ⚠️ Limited - API-based, geen officiële React SDK

#### ✅ Voordelen:
- **Developer-friendly** - Goede API
- **Flexibel** - Veel aanpassingsmogelijkheden

#### ⚠️ Nadelen:
- **Geen officiële React SDK** - Moet zelf widget bouwen
- **Minder embedded** - Vaak redirects nodig
- **Account setup** - Complexere setup

---

## 📊 Vergelijkingstabel

| Provider | React SDK | Embedded Widget | Wereldwijde Dekking | Fees | UX | Setup Moeilijkheid |
|----------|-----------|-----------------|---------------------|------|----|-------------------|
| **Ramp** | ✅ Ja | ✅ Volledig embedded | ✅ 150+ landen | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ Eenvoudig |
| **Transak** | ✅ Ja | ✅ Volledig embedded | ✅ 150+ landen | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ Eenvoudig |
| **MoonPay** | ✅ Ja | ✅ Volledig embedded | ✅ Wereldwijd | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ Moeilijk (account activatie) |
| **Onramper** | ✅ Ja | ⚠️ Popups | ✅ Wereldwijd | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ Eenvoudig |
| **Coinbase Pay** | ✅ Ja | ✅ Embedded | ✅ Wereldwijd | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ Moeilijk |

---

## 🎯 Aanbeveling voor Blaze Wallet

### **Beste Keuze: Ramp Network** ⭐

**Waarom Ramp:**
1. ✅ **Beste UX** - Modern, gebruiksvriendelijk, embedded widget
2. ✅ **React SDK** - Officiële, goed onderhouden package
3. ✅ **Geen popups** - Alles binnen Blaze UI
4. ✅ **Wereldwijde dekking** - 150+ landen
5. ✅ **Multi-chain** - Alle chains die je nodig hebt
6. ✅ **Betrouwbaar** - Grote naam, veel gebruikt
7. ✅ **Goede documentatie** - Makkelijk te implementeren
8. ✅ **KYC onthouden** - Na eerste keer niet meer nodig

**Alternatief: Transak**
- Ook goede optie
- Iets minder moderne UI dan Ramp
- Maar wel goed onderhouden en betrouwbaar

---

## 🚀 Implementatie Stappen (Ramp)

### 1. Account Aanmaken
- Ga naar: https://ramp.network/
- Maak business account aan
- Voltooi KYC/verificatie

### 2. API Keys Ophalen
- Ga naar dashboard
- Kopieer API keys (public & secret)

### 3. React SDK Installeren
```bash
npm install @ramp-network/react
```

### 4. Implementeren
- Vervang MoonPay integratie met Ramp
- Gebruik embedded widget variant
- Configureer voor alle chains

### 5. Testen
- Test in sandbox mode
- Test alle payment methods
- Test op mobile & desktop

---

## 📝 Conclusie

**Voor Blaze Wallet raad ik aan:**
1. **Ramp Network** - Beste overall keuze (UX, SDK, embedded)
2. **Transak** - Goede tweede keuze
3. **MoonPay** - Blijven gebruiken als account wordt geactiveerd

**Waarom niet Onramper:**
- Je hebt al aangegeven dat je popups en herhaalde KYC niet fijn vindt
- Onramper gebruikt vaak popups (niet altijd embedded)

---

*Laatste update: 19 December 2025*

