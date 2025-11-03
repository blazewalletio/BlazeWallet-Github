# 📱 Blaze Wallet Native App Build Guide

## ✅ Wat is al klaar?

- ✅ iOS platform toegevoegd (`/ios`)
- ✅ Android platform toegevoegd (`/android`)
- ✅ Breez SDK geïnstalleerd (`@breeztech/react-native-breez-sdk`)
- ✅ Greenlight certificate geïmplementeerd
- ✅ `BreezService` met platform detectie
- ✅ Lightning functionaliteit compleet
- ✅ Capacitor configuratie

---

## 🎯 De Situatie

### **Huidige Status:**
De Blaze Wallet is een **Next.js web app** die perfect werkt:
- ✅ Web (blazewallet.io)
- ✅ PWA (installeerbaar op mobiel/desktop)
- ⚠️ Native apps (iOS/Android) - *bijna klaar!*

### **Het Probleem:**
Breez SDK is een **React Native** package dat:
- ✅ Werkt in native React Native apps
- ❌ Werkt **niet** in Next.js (zelfs niet met Capacitor)
- 💡 Vereist een **echte React Native omgeving**

---

## 🔥 Oplossingen (3 opties)

### **Optie 1: Separate React Native App** (Beste voor Production) ⭐
**Wat:** Bouw een aparte React Native app die Breez SDK gebruikt

**Voordelen:**
- ✅ 100% native performance
- ✅ Breez SDK werkt perfect
- ✅ App Store klaar
- ✅ Optimale Lightning ervaring

**Nadelen:**
- ⚠️ Aparte codebase onderhouden
- ⚠️ Meer ontwikkeltijd

**Hoe:**
```bash
# 1. Create React Native app
npx react-native init BlazeWalletNative

# 2. Install Breez SDK
cd BlazeWalletNative
npm install @breeztech/react-native-breez-sdk

# 3. Copy core wallet logic from Next.js
# 4. Integrate Breez SDK
# 5. Build for iOS/Android
```

**Tijdsinschatting:** 1-2 weken

---

### **Optie 2: Expo with React Native** (Snelst) 🚀
**Wat:** Gebruik Expo voor snellere React Native development

**Voordelen:**
- ✅ Snellere development
- ✅ OTA updates
- ✅ Makkelijker deployment
- ✅ Breez SDK werkt

**Nadelen:**
- ⚠️ Requires Expo dev build (Breez SDK is niet in Expo Go)

**Hoe:**
```bash
# 1. Create Expo app
npx create-expo-app BlazeWalletNative

# 2. Create dev build
npm install @breeztech/react-native-breez-sdk
npx expo prebuild

# 3. Run dev build
npx expo run:ios
npx expo run:android
```

**Tijdsinschatting:** 3-5 dagen

---

### **Optie 3: Hybrid Approach** (Pragmatisch) 🎯
**Wat:** Houd Next.js web app, gebruik WebLN voor nu

**Voordelen:**
- ✅ Geen aparte app nodig
- ✅ Werkt **nu** al (via Alby Go/Zeus)
- ✅ 100% bestaande code
- ✅ Upgrade later naar native

**Nadelen:**
- ⚠️ Users moeten externe wallet installeren
- ⚠️ Minder naadloos

**Status:**
**✅ VOLLEDIG GEÏMPLEMENTEERD!**
- Desktop: Alby extension
- Mobile: Alby Go / Zeus app
- Breez SDK klaar voor toekomstige native app

**Tijdsinschatting:** 0 dagen (al klaar!)

---

## 📊 Vergelijking

| Aspect | Optie 1 (RN) | Optie 2 (Expo) | Optie 3 (Hybrid) |
|--------|--------------|----------------|------------------|
| **Tijd** | 1-2 weken | 3-5 dagen | ✅ 0 dagen |
| **Maintenance** | Hoog | Medium | Laag |
| **Native Lightning** | ✅ Ja | ✅ Ja | ⚠️ Via WebLN |
| **Performance** | ✅✅✅ | ✅✅ | ✅ |
| **App Store Ready** | ✅ Ja | ✅ Ja | PWA |
| **Codebase** | Aparte app | Aparte app | ✅ Single |

---

## 🚀 Aanbeveling

### **Voor NU: Optie 3 (Hybrid)** ✅
**Waarom:**
- Users kunnen **nu** al Lightning gebruiken
- Werkt op **alle** platforms
- Zero extra development tijd
- Greenlight certificate is al klaar voor future native app

### **Voor LATER: Optie 2 (Expo)**
**Wanneer:**
- Als je 10,000+ actieve users hebt
- Als Lightning kritisch wordt voor user retention
- Als je budget hebt voor dedicated mobile developers

**Waarom:**
- Snellere development dan pure React Native
- OTA updates (zonder App Store approval)
- Makkelijker testen

---

## 💡 Volgende Stappen (afhankelijk van keuze)

### **Als je kiest voor Optie 3 (Hybrid - HUIDIG):**
```bash
# NIETS TE DOEN! 🎉
# Alles werkt al perfect:
# - Web: blazewallet.io
# - Desktop Lightning: Alby extension
# - Mobile Lightning: Alby Go / Zeus

# Test het zelf:
1. Desktop: Install Alby extension
2. Mobile: Install Alby Go
3. Open Blaze Wallet
4. Lightning werkt! ⚡
```

### **Als je kiest voor Optie 2 (Expo - TOEKOMST):**
```bash
# 1. Create new Expo project
npx create-expo-app BlazeWalletNative
cd BlazeWalletNative

# 2. Install dependencies
npm install @breeztech/react-native-breez-sdk
npm install ethers @solana/web3.js bitcoinjs-lib

# 3. Copy wallet services
cp -r ../BlazeWallet\ 21-10/lib ./src/services

# 4. Create dev build
npx expo prebuild

# 5. Run on iOS
npx expo run:ios

# 6. Run on Android
npx expo run:android

# 7. Test Lightning
# Open app → Navigate to Lightning → Create invoice
# Should work natively without external wallet!
```

---

## 🔐 Security Notes

### **Greenlight Certificate:**
- ✅ Al geïmplementeerd in Vercel env vars
- ✅ Al geïmplementeerd in `.env.local`
- 🔐 Veilig opgeslagen
- ⚡ Klaar voor native app

### **Voor Native App:**
Zorg dat je de certificate toevoegt in:
- iOS: `ios/App/App/Info.plist` (als base64)
- Android: `android/app/src/main/res/raw/greenlight.crt`

---

## ✅ Conclusie

**De implementatie is COMPLEET voor web/PWA!** 🎉

**Lightning werkt op:**
- ✅ Desktop (Alby extension)
- ✅ Mobile PWA (Alby Go / Zeus)
- ⏳ Native apps (Expo project - 3-5 dagen development)

**Jouw keuze:**
1. **Start nu met Optie 3** → Users kunnen Lightning gebruiken vandaag
2. **Upgrade later naar Optie 2** → Als je native performance wilt

**Aanbeveling:**
Start met Optie 3, meet user adoption, en upgrade naar native als het kritisch wordt.

---

## 📱 Test het Nu!

### **Desktop:**
1. Install Alby extension: https://getalby.com
2. Open Blaze Wallet
3. Navigate to Lightning
4. Create invoice → Werkt! ⚡

### **Mobile:**
1. Install Alby Go app
2. Open Blaze Wallet in Alby Go browser
3. Navigate to Lightning
4. Create invoice → Werkt! ⚡

---

**Klaar voor productie!** 🚀

