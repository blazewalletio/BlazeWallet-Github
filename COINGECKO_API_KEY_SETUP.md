# 🦎 CoinGecko API Key Setup

## ✅ API Key Configuratie

De CoinGecko SDK wordt nu gebruikt voor alle price history requests. De SDK detecteert automatisch of je een Demo API key (CG-xxx) of Pro API key gebruikt.

### **API Key Format**:
- **Demo Key**: `CG-xxx` → Automatisch gedetecteerd als demo tier
- **Pro Key**: Andere format → Automatisch gedetecteerd als pro tier
- **Geen Key**: Free tier (rate limited)

### **Huidige API Key**:
```
CG-2zNxDeFXb8KJ2DSnpWMdKi7z
```

---

## 🔧 Environment Variables

### **Voor Vercel (Production)**:

1. Ga naar: https://vercel.com/your-project/settings/environment-variables
2. Klik op **"Add New"** (of update bestaande)
3. Voeg toe:
   ```
   Key:   COINGECKO_API_KEY
   Value: CG-2zNxDeFXb8KJ2DSnpWMdKi7z
   Environment: ✓ Production ✓ Preview ✓ Development
   ```
4. Klik **Save**

### **Voor Local Development (.env.local)**:

Maak of update `.env.local` in de project root:

```bash
# CoinGecko API Key (Demo tier)
COINGECKO_API_KEY=CG-2zNxDeFXb8KJ2DSnpWMdKi7z
```

---

## ✅ Voordelen van SDK

1. **Type Safety**: Volledige TypeScript types
2. **Error Handling**: Typed errors (APIError subclasses)
3. **Automatic Retries**: 2x retries voor connection errors, rate limits, etc.
4. **Timeout Handling**: 30 seconden timeout
5. **API Key Detection**: Automatische detectie van Demo vs Pro keys
6. **Better Logging**: SDK logging support

---

## 📊 Interval Support

Met de betaalde API key worden alle timeframes ondersteund:

- **LIVE / 1D**: `interval=null` → 5-minute data (288 points)
- **7D / 30D**: `interval=hourly` → Hourly data (~168-720 points) ✅ **NU MOGELIJK**
- **1J / ALLES**: `interval=daily` → Daily data (~365 points)

---

## 🧪 Testing

Na het toevoegen van de API key:

1. **Restart development server**:
   ```bash
   npm run dev
   ```

2. **Test price charts**:
   - Open token details voor ETH
   - Test alle timeframes: LIVE, 1D, 7D, 30D, 1J, ALLES
   - Verify dat alle charts data tonen

3. **Check logs**:
   - Look for `🦎 [CoinGecko SDK] Client initialized with Demo API key`
   - Verify `source: 'CoinGecko SDK'` in API responses

---

## ⚠️ Troubleshooting

### **Rate Limit Errors**:
- Free tier: 10-50 calls/min
- Demo tier: Higher limits
- Pro tier: Highest limits

### **API Key Not Working**:
- Check of key correct is in Vercel env vars
- Verify key format (CG-xxx voor demo)
- Check logs voor `🦎 [CoinGecko SDK]` messages

### **Hourly Interval Not Working**:
- Free tier ondersteunt mogelijk geen hourly interval
- Met betaalde key (Demo/Pro) zou het moeten werken
- Check logs voor error messages

---

**Laatste update**: 29 december 2025

