# ✅ Onramper Implementatie Verbeteringen

## Belangrijke Bevindingen uit Documentatie

### 1. **Parameter Namen**
- ❌ `amount` bestaat NIET in de documentatie
- ✅ Gebruik `defaultAmount` (moet gebruikt worden met `defaultFiat`)
- ✅ Voeg `defaultFiat` en `defaultCrypto` toe voor betere UX

### 2. **Redirect Behavior**
- ✅ Voeg `redirectAtCheckout=false` toe
- Dit zorgt ervoor dat checkout in nieuwe tab opent (beter voor popup)
- Default wordt `true` vanaf 25 juni 2025, maar voor web-based is `false` aanbevolen

### 3. **Payment Method**
- ✅ Voeg zowel `onlyPaymentMethods` als `defaultPaymentMethod` toe
- `defaultPaymentMethod` pre-selecteert de payment method

### 4. **URL Signing**
- ✅ Update signing om `defaultAmount` en `defaultCrypto` te gebruiken (niet `amount`)
- ✅ Sign alleen sensitive parameters: wallets, cryptoIds, amounts, paymentMethods
- ✅ `defaultFiat` en `onlyFiats` zijn NIET sensitive volgens docs

## Wat Ik Heb Geüpdatet

1. ✅ `amount` → `defaultAmount`
2. ✅ Toegevoegd: `defaultFiat`, `defaultCrypto`
3. ✅ Toegevoegd: `redirectAtCheckout=false`
4. ✅ Toegevoegd: `defaultPaymentMethod` (naast `onlyPaymentMethods`)
5. ✅ Signing gebruikt nu `defaultAmount` en `defaultCrypto`

## Nog Te Doen

⏳ **WACHT OP SECRET KEY**
- Code is nu correct volgens documentatie ✅
- Implementatie volgt exact de parameter namen uit docs ✅
- Secret key nodig van Onramper ⏳

## Alternatief: Direct Checkout Flow

De documentatie toont ook een "Direct checkout / Skip Onramper's Transaction Screen" flow:

```
skipTransactionScreen=true
txnAmount=300
txnFiat=eur
txnCrypto=btc
txnPaymentMethod=creditcard
txnRedirect=true
```

Dit zou kunnen werken ZONDER signing? Misschien proberen als secret key niet beschikbaar is?

