# 🖼️ LOGO VALIDATION AUDIT

## Probleem
Niet alle plekken accepteren `blob:` URLs voor logo's.

## Gevonden Locaties

### ✅ CORRECT (accepteert blob URLs)
1. **TokenLogo.tsx** - Gebruikt TokenLogoCache direct, GEEN validatie → ✅ WERKT
2. **Dashboard.tsx** (native & tokens) - ✅ GEFIXED - accepteert blob:

### ❌ INCORRECT (blob URLs worden niet geaccepteerd)

3. **SwapModal.tsx** (2x)
   - Line 856: `fromTokenDisplay.logo.startsWith('http') || fromTokenDisplay.logo.startsWith('/')`
   - Line 1003: `toTokenDisplay.logo.startsWith('http') || toTokenDisplay.logo.startsWith('/')`
   - ❌ Mist: `startsWith('blob:')` en `startsWith('data:')`

4. **TokenDetailModal.tsx** (2x)
   - Line 249: `token.logo.startsWith('http') || token.logo.startsWith('/')`
   - Line 279: `token.logo.startsWith('http') || token.logo.startsWith('/')`
   - ❌ Mist: `startsWith('blob:')` en `startsWith('data:')`

5. **SendModal.tsx** (2x)
   - Line 671: `selectedAsset.logo.startsWith('/') ? ... : ...` (weird check)
   - Line 715: `asset.logo.startsWith('/') ? ... : ...`
   - ❌ Logica is onduidelijk, moet blob: accepteren

### ✅ GEEN PROBLEEM (andere methode)
- **TransactionHistory.tsx** - Geen validatie, gewoon src={logoUrl} → werkt
- **AIPortfolioAdvisor.tsx** - Next Image component, accepteert alles
- **TokenSearchModal.tsx** - Gebruikt TokenLogo component → OK
- **ChainSelector.tsx** - Chain logos (lokale files) → OK

## Te Fixen Files
1. SwapModal.tsx (2 plekken)
2. TokenDetailModal.tsx (2 plekken)  
3. SendModal.tsx (2 plekken)

## Standaard Validatie Pattern
```typescript
if (
  logoUrl.startsWith('http') ||
  logoUrl.startsWith('/') ||
  logoUrl.startsWith('data:') ||
  logoUrl.startsWith('blob:')
) {
  // Show image
}
```
