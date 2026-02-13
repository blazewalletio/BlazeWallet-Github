# 🚀 ONRAMPER INTEGRATION - PERFECT IMPLEMENTATION PLAN

## 📋 OVERZICHT

Dit document beschrijft de **allerbeste, meest perfecte en flawless** manier om Onramper te integreren in Blaze Wallet ter vervanging van Transak.

---

## 🎯 WAAROM ONRAMPER?

### Voordelen t.o.v. Transak:
- ✅ **Betere UX**: Naadloze widget integratie
- ✅ **Meer payment methods**: iDeal | Wero, creditcard, bank transfer, Apple Pay, Google Pay
- ✅ **Betere rates**: Aggregeert meerdere providers voor beste prijzen
- ✅ **Multi-chain native**: Ondersteunt alle chains out-of-the-box
- ✅ **Webhook support**: Real-time transactie updates
- ✅ **Eenvoudigere integratie**: Minder configuratie nodig

---

## 🏗️ ARCHITECTUUR

### **Optie 1: iFrame Embed (AANBEVOLEN) ⭐**
**Voordelen:**
- Naadloze UX (geen popup)
- Gebruiker blijft in app
- Volledige controle over styling
- Betere mobile experience

**Nadelen:**
- iFrame security considerations
- Minder flexibel dan popup

### **Optie 2: Popup Window (ALTERNATIEF)**
**Voordelen:**
- Volledige controle voor Onramper
- Geen iFrame security issues
- Eenvoudiger implementatie

**Nadelen:**
- Popup blockers kunnen problemen veroorzaken
- Minder naadloze UX

**✅ AANBEVELING: Optie 1 (iFrame) voor beste UX**

---

## 📦 IMPLEMENTATIE STRUCTUUR

```
lib/
  ├── onramper-service.ts          # Onramper service class
  └── types.ts                      # TypeScript types

components/
  └── BuyModal.tsx                 # Updated met Onramper

app/api/
  ├── onramper/
  │   ├── init/route.ts            # Initialize Onramper widget
  │   ├── quotes/route.ts          # Get real-time quotes
  │   ├── assets/route.ts          # Get supported assets
  │   └── webhook/route.ts         # Handle webhook callbacks
```

---

## 🔧 IMPLEMENTATIE STAPPEN

### **STAP 1: Onramper Service Class**

**File:** `lib/onramper-service.ts`

**Functionaliteit:**
- ✅ Get supported assets per chain
- ✅ Get supported payment methods
- ✅ Generate widget URL met alle parameters
- ✅ Validate wallet addresses
- ✅ Map chain IDs naar Onramper network codes
- ✅ Create multi-chain wallet addresses object

**Key Features:**
```typescript
class OnramperService {
  // Get supported assets for chain
  static getSupportedAssets(chainId: number): string[]
  
  // Get widget URL with all parameters
  static getWidgetUrl(config: OnramperConfig): string
  
  // Map chain to Onramper network code
  static getNetworkCode(chainId: number): string
  
  // Validate wallet address format
  static validateWalletAddress(address: string, asset: string): boolean
  
  // Create multi-chain addresses object
  static createWalletAddresses(address: string, chainId: number): Record<string, string>
}
```

---

### **STAP 2: Server-Side API Route**

**File:** `app/api/onramper/init/route.ts`

**Functionaliteit:**
- ✅ Server-side API key beveiliging
- ✅ Validate input parameters
- ✅ Generate secure widget URL
- ✅ Add all required Onramper parameters
- ✅ Support voor multi-chain addresses

**Security:**
- API key NOOIT in client code
- Server-side validatie
- Rate limiting (optioneel)

**Parameters:**
```typescript
{
  walletAddress: string;        // Primary wallet address
  walletAddresses?: Record<string, string>; // Multi-chain addresses
  defaultAsset?: string;        // e.g., 'ETH', 'USDT'
  defaultFiat?: string;         // e.g., 'EUR', 'USD'
  chainId?: number;             // Current chain
  theme?: 'light' | 'dark';     // Theme preference
}
```

---

### **STAP 3: BuyModal Component Update**

**File:** `components/BuyModal.tsx`

**Changes:**
- ✅ Replace TransakService met OnramperService
- ✅ Update UI voor Onramper branding
- ✅ iFrame embed in plaats van popup
- ✅ Real-time quotes display (optioneel)
- ✅ Better error handling

**UI Flow:**
1. User klikt op "Buy" button
2. BuyModal opent
3. User selecteert crypto (optioneel)
4. iFrame met Onramper widget laadt
5. User voltooit aankoop in widget
6. Webhook update transactie status
7. Modal sluit automatisch na succes

---

### **STAP 4: Webhook Handler**

**File:** `app/api/onramper/webhook/route.ts`

**Functionaliteit:**
- ✅ Receive webhook callbacks van Onramper
- ✅ Validate webhook signature
- ✅ Update transactie status in database
- ✅ Notify user van status updates
- ✅ Log alle events voor debugging

**Webhook Events:**
- `PENDING` - Transactie gestart
- `PROCESSING` - Betaling ontvangen, crypto wordt verzonden
- `COMPLETED` - Crypto succesvol verzonden
- `FAILED` - Transactie gefaald
- `REFUNDED` - Terugbetaling uitgevoerd

---

### **STAP 5: Environment Variables**

**Vercel Environment Variables:**
```bash
ONRAMPER_API_KEY=your_api_key_here
ONRAMPER_WEBHOOK_SECRET=your_webhook_secret_here
ONRAMPER_ENVIRONMENT=production  # or 'sandbox' for testing
```

**Local Development (.env.local):**
```bash
ONRAMPER_API_KEY=your_api_key_here
ONRAMPER_WEBHOOK_SECRET=your_webhook_secret_here
ONRAMPER_ENVIRONMENT=sandbox
```

---

## 🔐 SECURITY BEST PRACTICES

### **1. API Key Beveiliging**
- ✅ NOOIT API key in client code
- ✅ Server-side API route gebruikt
- ✅ Environment variables alleen op server
- ✅ Rate limiting op API routes

### **2. Webhook Security**
- ✅ Validate webhook signature
- ✅ Check timestamp (prevent replay attacks)
- ✅ Verify webhook secret
- ✅ Log alle webhook events

### **3. Input Validation**
- ✅ Validate wallet addresses
- ✅ Sanitize user input
- ✅ Check chain compatibility
- ✅ Validate amounts

---

## 🌐 MULTI-CHAIN SUPPORT

### **Supported Chains:**
- ✅ Ethereum (1)
- ✅ Polygon (137)
- ✅ BSC (56)
- ✅ Arbitrum (42161)
- ✅ Optimism (10)
- ✅ Base (8453)
- ✅ Avalanche (43114)
- ✅ Solana (101) - via special handling

### **Chain Mapping:**
```typescript
const chainToNetwork: Record<number, string> = {
  1: 'ethereum',
  137: 'polygon',
  56: 'bsc',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
  43114: 'avalanche',
  101: 'solana',
};
```

---

## 💳 SUPPORTED ASSETS

### **Per Chain:**

**Ethereum:**
- ETH, USDT, USDC, DAI, WBTC, LINK, UNI, AAVE

**Polygon:**
- MATIC, USDT, USDC

**BSC:**
- BNB, USDT, BUSD

**Arbitrum:**
- ETH, USDT, USDC

**Optimism:**
- ETH, USDT

**Base:**
- ETH, USDC

**Solana:**
- SOL, USDC, USDT

---

## 🎨 UI/UX CONSIDERATIONS

### **iFrame Embed:**
- ✅ Responsive design (mobile + desktop)
- ✅ Loading state tijdens widget load
- ✅ Error state als widget faalt
- ✅ Success state na voltooide transactie
- ✅ Smooth animations

### **Theme Customization:**
- ✅ Match Blaze Wallet orange theme
- ✅ Dark/light mode support
- ✅ Custom branding colors

---

## 📊 ERROR HANDLING

### **Error Scenarios:**
1. **API Key Missing**
   - Show friendly error message
   - Log error voor debugging
   - Fallback naar "Coming Soon" state

2. **Invalid Wallet Address**
   - Validate before opening widget
   - Show specific error message
   - Suggest correct format

3. **Widget Load Failed**
   - Retry mechanism
   - Fallback naar popup method
   - Show error message

4. **Network Errors**
   - Retry logic
   - Offline detection
   - User-friendly messages

---

## 🧪 TESTING STRATEGY

### **1. Sandbox Environment**
- ✅ Test met Onramper sandbox API key
- ✅ Test alle payment methods
- ✅ Test alle supported assets
- ✅ Test webhook callbacks

### **2. Integration Tests**
- ✅ Test widget loading
- ✅ Test multi-chain addresses
- ✅ Test error scenarios
- ✅ Test webhook validation

### **3. User Acceptance Testing**
- ✅ Test complete flow
- ✅ Test op verschillende devices
- ✅ Test verschillende browsers
- ✅ Test verschillende payment methods

---

## 📈 MONITORING & ANALYTICS

### **Metrics to Track:**
- ✅ Widget load time
- ✅ Conversion rate (clicks → purchases)
- ✅ Average transaction amount
- ✅ Most popular assets
- ✅ Most popular payment methods
- ✅ Error rates
- ✅ Webhook delivery success rate

### **Logging:**
- ✅ All API calls
- ✅ All webhook events
- ✅ All errors
- ✅ User actions

---

## 🚀 DEPLOYMENT CHECKLIST

### **Pre-Deployment:**
- [ ] Onramper API key verkregen
- [ ] Webhook secret verkregen
- [ ] Webhook URL geconfigureerd in Onramper dashboard
- [ ] Environment variables toegevoegd aan Vercel
- [ ] Sandbox testing voltooid
- [ ] Code review voltooid

### **Deployment:**
- [ ] Deploy naar staging
- [ ] Test in staging environment
- [ ] Deploy naar production
- [ ] Monitor error logs
- [ ] Verify webhook delivery

### **Post-Deployment:**
- [ ] Monitor metrics
- [ ] Check user feedback
- [ ] Fix any issues
- [ ] Optimize performance

---

## 📝 MIGRATION FROM TRANSAK

### **Steps:**
1. ✅ Create OnramperService (parallel met TransakService)
2. ✅ Update BuyModal om beide te ondersteunen (feature flag)
3. ✅ Test Onramper integratie
4. ✅ Switch feature flag naar Onramper
5. ✅ Monitor voor issues
6. ✅ Remove Transak code na stabiliteit

### **Backward Compatibility:**
- ✅ Keep Transak code voor rollback
- ✅ Feature flag voor easy switching
- ✅ Gradual migration mogelijk

---

## 🎯 SUCCESS CRITERIA

### **Functional:**
- ✅ Users kunnen crypto kopen via Onramper
- ✅ Alle supported chains werken
- ✅ Webhooks worden correct verwerkt
- ✅ Error handling werkt correct

### **Performance:**
- ✅ Widget laadt binnen 2 seconden
- ✅ API calls < 500ms
- ✅ Webhook processing < 1s

### **UX:**
- ✅ Smooth user experience
- ✅ Clear error messages
- ✅ Loading states
- ✅ Success feedback

---

## 📚 RESOURCES

### **Onramper Documentation:**
- API Docs: https://docs.onramper.com/
- Integration Guide: https://docs.onramper.com/docs/integration-steps
- Webhook Docs: https://docs.onramper.com/docs/webhooks
- Theme Configurator: https://docs.onramper.com/docs/theme-configurator

### **Support:**
- Onramper Support: support@onramper.com
- Sales Team: sales@onramper.com

---

## ✅ NEXT STEPS

1. **Get Onramper API Key**
   - Contact Onramper sales team
   - Request API key + webhook secret
   - Configure webhook URL in dashboard

2. **Implement OnramperService**
   - Create service class
   - Implement all helper methods
   - Add TypeScript types

3. **Create API Routes**
   - `/api/onramper/init` - Widget initialization
   - `/api/onramper/webhook` - Webhook handler
   - `/api/onramper/quotes` - Real-time quotes (optional)

4. **Update BuyModal**
   - Replace Transak met Onramper
   - Add iFrame embed
   - Update UI/UX

5. **Test & Deploy**
   - Test in sandbox
   - Deploy to staging
   - Deploy to production

---

**🎉 Ready to implement the perfect Onramper integration!**

