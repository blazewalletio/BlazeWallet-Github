# 🧪 Hoe Test Je Onramper URL Signing?

## Methode 1: HTML Test Tool (MEEST MAKKELIJK) ✅

1. **Open de test file:**
   ```bash
   open test-onramper-urls.html
   ```
   Of dubbelklik op `test-onramper-urls.html` in Finder

2. **In de browser:**
   - Je ziet 5 verschillende signing methoden
   - Voor elke methode: klik op **"Test in Popup"**
   - Een popup opent met de Onramper widget

3. **Check het resultaat:**
   - ✅ **Werkt**: Widget laadt zonder "Signature validation failed" error
   - ❌ **Werkt niet**: Je ziet "Signature validation failed" error

4. **Markeer welke werkt:**
   - Klik op **"✅ Works"** voor de methode die werkt
   - Of klik op **"❌ Failed"** als het niet werkt

5. **Laat me weten:**
   - Welke methode werkt (bijv. "Method 2 werkt!")
   - Dan update ik de code met de juiste methode

---

## Methode 2: Handmatig Testen (ALS HTML NIET WERKT)

1. **Run het test script:**
   ```bash
   node test-onramper-direct.js
   ```

2. **Je krijgt URLs zoals deze:**
   ```
   Method 1: Sign all params (current)
   Full URL: https://buy.onramper.com?apiKey=...&signature=...
   ```

3. **Kopieer elke "Full URL"** en plak in je browser

4. **Check of de widget laadt:**
   - ✅ Werkt: Widget laadt normaal
   - ❌ Werkt niet: "Signature validation failed" error

5. **Laat me weten welke URL werkt**

---

## Methode 3: Direct in Code Testen

Als je de Blaze Wallet lokaal runt:

1. **Start de dev server:**
   ```bash
   npm run dev
   ```

2. **Open de app** in browser

3. **Klik op "Buy" button**

4. **Probeer een aankoop** te doen

5. **Check de console** voor errors

6. **Check Vercel logs** (als deployed) voor Onramper API errors

---

## Wat Te Zoeken?

### ✅ WERKT:
- Widget laadt zonder errors
- Je ziet de Onramper payment interface
- Je kunt crypto en fiat selecteren

### ❌ WERKT NIET:
- "Signature validation failed" error
- Widget laadt niet
- Blanke pagina

---

## Snelle Test (1 Minuut)

**Gewoon deze URL in je browser plakken:**
```
https://buy.onramper.com?apiKey=pk_prod_01KBJCSS9G727A14XA544DSS7D&onlyCryptos=ETH&onlyFiats=EUR&amount=100&wallets=ETH%3A0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&signature=039f7a196960f2b74b27ad4c19966fbc0bef4f9293e227e5d80b0f65eb4ba3cc
```

Als deze werkt → Method 1 is correct
Als deze NIET werkt → Test de andere methoden

---

## Hulp Nodig?

Als niets werkt:
1. Check of popups niet geblokkeerd zijn
2. Check browser console voor errors (F12)
3. Laat me weten wat je ziet

