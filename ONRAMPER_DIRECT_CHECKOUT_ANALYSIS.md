# 🔍 Onramper Direct Checkout Flow - Analyse

## Uit Documentatie

### Direct checkout / Skip Onramper's Transaction Screen

**Doel:** Gebruik je eigen transaction input en onramp selection screens, skip het eerste scherm in Onramper's widget.

**Parameters voor Onramp Transactions:**
- `skipTransactionScreen` (Yes) - true/false
- `txnType` (No) - transaction type (e.g. buy)
- `txnAmount` (Yes) - requested fiat amount
- `txnFiat` (Yes) - Fiat Currency ID
- `txnCrypto` (Yes) - Crypto Currency ID  
- `txnPaymentMethod` (No) - Payment Method ID
- `txnOnramp` (No) - Provider ID (als niet gespecificeerd, gebruikt Onramper Ranking Engine)
- `txnRedirect` (No) - Allows direct redirection to provider's widget

**Voorbeeld URL:**
```
https://buy.onramper.com/?skipTransactionScreen=true&txnAmount=300&txnFiat=eur&txnCrypto=btc&txnPaymentMethod=creditcard&txnRedirect=true
```

## Belangrijke Vragen

### 1. Is URL Signing Nodig?
- Documentatie zegt: "⚠️ When using this parameter, please also make sure to follow the implementation guide for Widget URL Signing. Otherwise checkout requests are going to be rejected."
- Dit geldt voor: `wallets`, `networkWallets`, `walletAddressTags`
- **Vraag:** Moeten we `wallets` parameter toevoegen aan direct checkout flow?

### 2. Wallets Parameter?
- Documentatie zegt: "When passing the wallets parameter, make sure to pass all wallets for the cryptocurrencies you have enabled using the onlyCryptos parameter."
- **Conclusie:** We moeten waarschijnlijk `wallets` toevoegen, wat betekent dat signing nodig is!

### 3. Welke Parameters Moeten Gesigned Worden?
- Volgens signing docs: wallets, cryptoIds, amounts
- In direct checkout: `txnCrypto` (crypto ID), `txnAmount` (amount), `wallets` (als toegevoegd)
- **Conclusie:** We moeten waarschijnlijk `txnCrypto`, `txnAmount`, en `wallets` signen

## Implementatie Plan

### Optie A: Direct Checkout MET Wallets (Aanbevolen)
```
skipTransactionScreen=true
txnAmount=300
txnFiat=eur
txnCrypto=btc
txnPaymentMethod=creditcard
txnRedirect=true
wallets=btc:walletAddress
```
- ✅ Gebruiker hoeft wallet address niet in te voeren
- ✅ URL signing vereist (omdat wallets parameter wordt gebruikt)

### Optie B: Direct Checkout ZONDER Wallets
```
skipTransactionScreen=true
txnAmount=300
txnFiat=eur
txnCrypto=btc
txnPaymentMethod=creditcard
txnRedirect=true
```
- ❌ Gebruiker moet wallet address handmatig invoeren
- ❓ Signing mogelijk niet nodig (maar onzeker)

## Aanbeveling

**Gebruik Optie A** - Voeg `wallets` parameter toe en implementeer signing.
Dit geeft de beste UX en volgt de documentatie.

