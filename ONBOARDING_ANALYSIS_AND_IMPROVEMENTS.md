# 🔥 BLAZE WALLET - ONBOARDING FLOW ANALYSE & VERBETERPLAN

**Datum:** 22 November 2025  
**Status:** Grondige Analyse Compleet  
**Prioriteit:** 🔴 CRITICAL - Eerste indruk is cruciaal

---

## 📊 EXECUTIVE SUMMARY

De huidige onboarding flow heeft **significante UX/UI problemen** die de professionele uitstraling van BLAZE Wallet schaden. Dit document bevat een complete analyse en een gedetailleerd verbeterplan.

### **Huidige Problemen:**
1. ❌ **Desktop centering:** Content niet perfect gecentreerd (te veel top padding, inconsistent)
2. ❌ **Layout inconsistenties:** Mix van cards en direct content, geen uniforme stijl
3. ❌ **Spacing chaos:** Inconsistente margins/padding tussen screens
4. ❌ **Visual hierarchy:** Niet altijd duidelijk wat belangrijk is
5. ❌ **Button styling:** Verschillende stijlen door de flow heen
6. ❌ **Typography:** Font sizes niet consistent
7. ❌ **Mobile responsiveness:** Niet optimaal voor alle screen sizes
8. ❌ **Flow complexity:** Te veel stappen, kan simpeler

---

## 🔍 GEDETAILLEERDE PROBLEEM ANALYSE

### **1. WELCOME SCREEN (Carousel) - CRITICAL ISSUES**

#### **Probleem A: Desktop Centering**
```tsx
// HUIDIG (Onboarding.tsx:365)
<div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative flex items-start justify-center pt-12 sm:pt-16 lg:pt-20">
```

**Issues:**
- ❌ `items-start` in plaats van `items-center` → Content start bovenaan
- ❌ `pt-12 sm:pt-16 lg:pt-20` → Te veel top padding op desktop
- ❌ Content wrapper heeft `max-w-5xl` maar niet perfect gecentreerd
- ❌ Floating icons kunnen buiten viewport vallen op kleine desktop screens

**Visueel Probleem:**
```
Desktop (1920x1080):
┌─────────────────────────────────────┐
│  [Te veel witruimte boven]          │ ← pt-20 = 80px te veel!
│                                     │
│  [Content start hier]               │ ← Moet gecentreerd zijn
│  ┌─────────────────────────────┐   │
│  │  Welcome to Blaze            │   │
│  │  [Logo + Crypto icons]       │   │
│  │  [Buttons]                   │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Te veel witruimte onder]         │
└─────────────────────────────────────┘
```

**Gewenst:**
```
Desktop (1920x1080):
┌─────────────────────────────────────┐
│                                     │
│                                     │
│        ┌─────────────────────┐     │ ← Perfect gecentreerd
│        │  Welcome to Blaze   │     │
│        │  [Logo + Icons]     │     │
│        │  [Buttons]          │     │
│        └─────────────────────┘     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

#### **Probleem B: Content Container Layout**
```tsx
// HUIDIG (Onboarding.tsx:370)
<div className="w-full max-w-5xl relative z-10 px-4 sm:px-6 pb-8 sm:pb-12">
```

**Issues:**
- ❌ `max-w-5xl` (1024px) is te breed voor welcome screen
- ❌ `w-full` + `max-w-5xl` zonder centering → Links aligned op grote screens
- ❌ Inconsistente padding (`px-4 sm:px-6` vs `pb-8 sm:pb-12`)

#### **Probleem C: Floating Icons Positioning**
```tsx
// HUIDIG (Onboarding.tsx:430-445)
<FloatingIcon delay={0} className="top-4 left-4 lg:top-8 lg:left-8">
  <img src={cryptoLogos[0].image} ... />
</FloatingIcon>
```

**Issues:**
- ❌ Absolute positioning met fixed values → Kan buiten container vallen
- ❌ Geen responsive sizing voor verschillende screen sizes
- ❌ Icons kunnen overlappen op kleine desktop screens

#### **Probleem D: Carousel Content Height**
```tsx
// HUIDIG (Onboarding.tsx:383)
<div className="overflow-y-auto overflow-x-hidden mb-6 lg:mb-8 max-h-[500px] lg:max-h-[600px] flex items-start">
```

**Issues:**
- ❌ `max-h-[500px]` met scroll → Kan verwarrend zijn (waarom scroll?)
- ❌ `items-start` → Content niet gecentreerd in scroll container
- ❌ Fixed height kan problemen geven op verschillende screen sizes

---

### **2. CREATE OPTIONS SCREEN - LAYOUT ISSUES**

#### **Probleem A: Inconsistent Spacing**
```tsx
// HUIDIG (Onboarding.tsx:651)
<div className="mb-8 lg:mb-10">  // Back button
<div className="text-center mb-8 lg:mb-10">  // Header
<div className="space-y-3 lg:space-y-4 mb-6 lg:mb-8">  // Options
```

**Issues:**
- ❌ Verschillende margin bottom values (`mb-8`, `mb-6`, `mb-10`)
- ❌ Geen consistent spacing system
- ❌ Desktop vs Mobile spacing niet proportioneel

#### **Probleem B: Button Styling Inconsistent**
```tsx
// Email button (Onboarding.tsx:678)
className="w-full p-4 lg:p-5 rounded-xl flex items-center justify-between bg-gradient-to-br from-orange-500 to-yellow-500..."

// Seed phrase button (Onboarding.tsx:697)
className="w-full p-4 lg:p-5 rounded-xl flex items-center gap-3 lg:gap-4 bg-white hover:bg-gray-50..."
```

**Issues:**
- ❌ Email button: `justify-between` (badge rechts)
- ❌ Seed button: `gap-3 lg:gap-4` (geen badge)
- ❌ Verschillende padding (`p-4 lg:p-5` vs consistent)
- ❌ Hover states niet consistent

---

### **3. EMAIL AUTH SCREEN - FORM LAYOUT**

#### **Probleem A: Form Width**
```tsx
// HUIDIG (Onboarding.tsx:801)
className="w-full max-w-md lg:max-w-xl mx-auto"
```

**Issues:**
- ❌ `max-w-md` (448px) te smal voor desktop
- ❌ `max-w-xl` (576px) nog steeds smal op grote screens
- ❌ Form fields kunnen breder zijn voor betere UX

#### **Probleem B: Social Buttons Disabled State**
```tsx
// HUIDIG (Onboarding.tsx:831-859)
<button disabled className="...">
  <span className="flex-1 text-center mr-16">Continue with Google</span>
  <span className="absolute right-3 ...">Coming soon</span>
</button>
```

**Issues:**
- ❌ `mr-16` hack om ruimte te maken voor badge → Slordig
- ❌ Disabled buttons zien er slecht uit (gray-400)
- ❌ "Coming soon" badge kan beter geïntegreerd worden

#### **Probleem C: Form Field Spacing**
```tsx
// HUIDIG (Onboarding.tsx:876)
<form className="space-y-4">
```

**Issues:**
- ❌ `space-y-4` (16px) kan te klein zijn voor desktop
- ❌ Geen responsive spacing (mobile vs desktop)

---

### **4. IMPORT SEED SCREEN - TEXTAREA LAYOUT**

#### **Probleem A: Textarea Height**
```tsx
// HUIDIG (Onboarding.tsx:1211)
className="w-full h-32 p-4 bg-white border-2..."
```

**Issues:**
- ❌ `h-32` (128px) te klein voor 12 woorden
- ❌ Geen responsive height (groter op desktop)
- ❌ Fixed height kan problemen geven met lange phrases

---

### **5. MNEMONIC SCREEN - CRITICAL SECURITY WARNING**

#### **Probleem A: Warning Box Layout**
```tsx
// HUIDIG (Onboarding.tsx:1263)
<div className="bg-gradient-to-br from-red-500 to-red-600 rounded-3xl p-1 mb-6 shadow-2xl">
  <div className="bg-white rounded-[22px] p-5 sm:p-6">
```

**Issues:**
- ❌ Nested divs met gradient border → Complex
- ❌ `rounded-[22px]` custom value → Inconsistent met rest
- ❌ Padding kan beter responsive zijn

#### **Probleem B: Mnemonic Grid Layout**
```tsx
// HUIDIG (Onboarding.tsx:1346)
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
```

**Issues:**
- ❌ `grid-cols-2` op mobile → Te smal, woorden kunnen afbreken
- ❌ `grid-cols-4` op desktop → Kan beter 3 columns zijn voor leesbaarheid
- ❌ Gap sizes niet consistent met design system

---

### **6. VERIFY SCREEN - INPUT LAYOUT**

#### **Probleem A: Input Field Width**
```tsx
// HUIDIG (Onboarding.tsx:1458)
<div className="flex items-center gap-3">
  <div className="flex items-center gap-2 w-20 flex-shrink-0">
    <span>{wordIndex + 1}.</span>
  </div>
  <input className="flex-1 min-w-0 ..." />
</div>
```

**Issues:**
- ❌ `w-20` voor label → Te smal, kan tekst afbreken
- ❌ `gap-3` → Kan groter zijn voor betere spacing
- ❌ Input fields kunnen breder zijn

---

### **7. BIOMETRIC SETUP SCREEN - LAYOUT**

#### **Probleem A: Benefits Box**
```tsx
// HUIDIG (Onboarding.tsx:1534)
<div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6">
```

**Issues:**
- ❌ `p-4` → Kan groter zijn voor betere spacing
- ❌ Nested items hebben inconsistent spacing

---

## 🎯 VERBETERPLAN - DETAILED SOLUTIONS

### **PHASE 1: FOUNDATION FIXES (Critical)**

#### **Fix 1.1: Perfect Desktop Centering**

**Probleem:** Content niet gecentreerd op desktop

**Oplossing:**
```tsx
// NIEUW - Perfect centering voor alle screen sizes
<div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative flex items-center justify-center py-8 sm:py-12 lg:py-16">
  <div className="w-full max-w-md sm:max-w-lg lg:max-w-2xl xl:max-w-3xl relative z-10 px-4 sm:px-6 lg:px-8">
    {/* Content */}
  </div>
</div>
```

**Changes:**
- ✅ `items-center` in plaats van `items-start` → Perfect vertical centering
- ✅ `py-8 sm:py-12 lg:py-16` → Equal padding top/bottom
- ✅ Responsive max-width: `max-w-md` → `max-w-lg` → `max-w-2xl` → `max-w-3xl`
- ✅ Consistent padding: `px-4 sm:px-6 lg:px-8`

#### **Fix 1.2: Welcome Screen Container**

**Probleem:** Content wrapper te breed, niet gecentreerd

**Oplossing:**
```tsx
// NIEUW - Welcome screen specifieke container
{step === 'carousel' && (
  <motion.div
    key="carousel"
    className="w-full max-w-lg lg:max-w-2xl mx-auto"
  >
    {/* Carousel content */}
  </motion.div>
)}
```

**Changes:**
- ✅ `max-w-lg` (512px) voor mobile → Comfortabel
- ✅ `max-w-2xl` (672px) voor desktop → Niet te breed
- ✅ `mx-auto` → Perfect horizontal centering

#### **Fix 1.3: Floating Icons Responsive**

**Probleem:** Icons kunnen buiten container vallen

**Oplossing:**
```tsx
// NIEUW - Responsive icon container
<div className="relative h-48 sm:h-56 lg:h-64 xl:h-72 w-full max-w-sm lg:max-w-md mx-auto mb-6 lg:mb-8">
  {/* Container met max-width om overflow te voorkomen */}
  
  <FloatingIcon 
    delay={0} 
    className="top-0 left-0 sm:top-2 sm:left-2 lg:top-4 lg:left-4"
  >
    <img 
      src={cryptoLogos[0].image} 
      className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 xl:w-20 xl:h-20 object-contain" 
    />
  </FloatingIcon>
  
  {/* Center logo - responsive sizing */}
  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
    <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 xl:w-40 xl:h-40 bg-white rounded-full ...">
      {/* Logo */}
    </div>
  </div>
</div>
```

**Changes:**
- ✅ Container heeft `max-w-sm lg:max-w-md` → Voorkomt overflow
- ✅ Icons responsive sizing: `w-12` → `w-14` → `w-16` → `w-20`
- ✅ Position percentages in plaats van fixed pixels
- ✅ Center logo responsive: `w-24` → `w-28` → `w-32` → `w-40`

#### **Fix 1.4: Carousel Content Height**

**Probleem:** Fixed height met scroll → Verwarrend

**Oplossing:**
```tsx
// NIEUW - Auto height, geen scroll nodig
<div className="mb-6 lg:mb-8">
  <AnimatePresence mode="wait">
    <motion.div
      key={carouselPage}
      className="flex flex-col items-center justify-center min-h-[400px] sm:min-h-[450px] lg:min-h-[500px]"
    >
      {/* Content - auto height */}
    </motion.div>
  </AnimatePresence>
</div>
```

**Changes:**
- ✅ `min-h-[400px]` → Minimum height, geen max
- ✅ `flex flex-col items-center justify-center` → Content gecentreerd
- ✅ Geen scroll → Content past automatisch

---

### **PHASE 2: CONSISTENT SPACING SYSTEM**

#### **Fix 2.1: Unified Spacing Scale**

**Probleem:** Inconsistente margins/padding

**Oplossing:**
```tsx
// NIEUW - Consistent spacing system
const SPACING = {
  section: 'mb-8 sm:mb-10 lg:mb-12',      // Tussen grote secties
  element: 'mb-6 sm:mb-8 lg:mb-10',       // Tussen elementen
  field: 'mb-4 sm:mb-5 lg:mb-6',          // Tussen form fields
  small: 'mb-3 sm:mb-4',                  // Kleine spacing
};

// Gebruik:
<div className={SPACING.section}>  // Back button
<div className={SPACING.section}>  // Header
<div className={SPACING.element}>  // Options
```

**Changes:**
- ✅ Gedefinieerde spacing scale
- ✅ Responsive: Mobile → Tablet → Desktop
- ✅ Consistent door hele flow

#### **Fix 2.2: Button Consistency**

**Probleem:** Verschillende button stijlen

**Oplossing:**
```tsx
// NIEUW - Unified button styles
const BUTTON_STYLES = {
  primary: "w-full py-4 sm:py-5 lg:py-6 px-6 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 lg:hover:scale-[1.02] text-base sm:text-lg",
  
  secondary: "w-full py-4 sm:py-5 lg:py-6 px-6 bg-white hover:bg-gray-50 text-gray-900 font-bold rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all active:scale-95 lg:hover:scale-[1.02] text-base sm:text-lg",
  
  tertiary: "w-full py-3 sm:py-4 text-gray-600 hover:text-gray-900 text-sm sm:text-base font-semibold transition-colors",
};

// Gebruik:
<button className={BUTTON_STYLES.primary}>Create wallet</button>
<button className={BUTTON_STYLES.secondary}>Import wallet</button>
```

**Changes:**
- ✅ Consistent padding: `py-4 sm:py-5 lg:py-6`
- ✅ Consistent text size: `text-base sm:text-lg`
- ✅ Consistent hover/active states
- ✅ Herbruikbaar door hele flow

---

### **PHASE 3: FORM & INPUT IMPROVEMENTS**

#### **Fix 3.1: Form Container Width**

**Probleem:** Forms te smal op desktop

**Oplossing:**
```tsx
// NIEUW - Responsive form width
{step === 'email-auth' && (
  <motion.div className="w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto">
    {/* Form content */}
  </motion.div>
)}
```

**Changes:**
- ✅ `max-w-md` (448px) → Mobile
- ✅ `max-w-lg` (512px) → Tablet
- ✅ `max-w-xl` (576px) → Desktop
- ✅ `max-w-2xl` (672px) → Large desktop

#### **Fix 3.2: Form Field Spacing**

**Probleem:** `space-y-4` te klein

**Oplossing:**
```tsx
// NIEUW - Responsive form spacing
<form className="space-y-4 sm:space-y-5 lg:space-y-6">
  {/* Fields */}
</form>
```

**Changes:**
- ✅ `space-y-4` (16px) → Mobile
- ✅ `space-y-5` (20px) → Tablet
- ✅ `space-y-6` (24px) → Desktop

#### **Fix 3.3: Social Buttons Redesign**

**Probleem:** Disabled buttons zien er slecht uit

**Oplossing:**
```tsx
// NIEUW - Better disabled state
<button
  disabled
  className="w-full py-3 sm:py-4 px-4 bg-white border-2 border-gray-200 rounded-xl text-gray-500 font-semibold relative flex items-center justify-center gap-3 opacity-60 cursor-not-allowed"
>
  {/* Icon */}
  <svg className="w-5 h-5" ... />
  
  {/* Text - centered */}
  <span className="flex-1 text-center">Continue with Google</span>
  
  {/* Badge - absolute positioned */}
  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-orange-500/10 border border-orange-500/30 rounded-md text-[10px] text-orange-600 font-semibold">
    Coming soon
  </span>
</button>
```

**Changes:**
- ✅ `justify-center` → Text gecentreerd
- ✅ Badge absolute positioned → Geen `mr-16` hack
- ✅ `opacity-60` → Duidelijk disabled
- ✅ `cursor-not-allowed` → Visual feedback

---

### **PHASE 4: CONTENT LAYOUT IMPROVEMENTS**

#### **Fix 4.1: Textarea Height**

**Probleem:** `h-32` te klein voor 12 woorden

**Oplossing:**
```tsx
// NIEUW - Responsive textarea
<textarea
  value={importInput}
  onChange={(e) => setImportInput(e.target.value)}
  placeholder="Enter your 12-word recovery phrase..."
  className="w-full min-h-[120px] sm:min-h-[140px] lg:min-h-[160px] p-4 sm:p-5 bg-white border-2 border-gray-200 text-gray-900 rounded-xl resize-y focus:outline-none focus:border-orange-500 transition-all text-base sm:text-lg placeholder-gray-400"
/>
```

**Changes:**
- ✅ `min-h-[120px]` → Mobile (3-4 regels)
- ✅ `min-h-[140px]` → Tablet (4-5 regels)
- ✅ `min-h-[160px]` → Desktop (5-6 regels)
- ✅ `resize-y` → User kan uitbreiden indien nodig
- ✅ Responsive text size: `text-base sm:text-lg`

#### **Fix 4.2: Mnemonic Grid Layout**

**Probleem:** Grid columns niet optimaal

**Oplossing:**
```tsx
// NIEUW - Better grid layout
<div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
  {words.map((word, index) => (
    <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
      <span className="text-orange-500 font-bold text-xs sm:text-sm w-6 sm:w-8 flex-shrink-0">{index + 1}</span>
      <span className="font-mono text-xs sm:text-sm lg:text-base font-semibold text-gray-900 select-all break-all">{word}</span>
    </div>
  ))}
</div>
```

**Changes:**
- ✅ `grid-cols-3` → Mobile (4 rijen van 3)
- ✅ `grid-cols-4` → Tablet (3 rijen van 4)
- ✅ `grid-cols-3` → Desktop (4 rijen van 3) → Beter leesbaar
- ✅ `grid-cols-4` → Large desktop (3 rijen van 4)
- ✅ `break-all` → Voorkomt overflow bij lange woorden
- ✅ Responsive gap: `gap-3 sm:gap-4 lg:gap-5`

#### **Fix 4.3: Verify Input Layout**

**Probleem:** Label te smal, input kan breder

**Oplossing:**
```tsx
// NIEUW - Better input layout
<div className="flex items-center gap-4 sm:gap-5">
  <div className="flex items-center gap-2 w-24 sm:w-28 lg:w-32 flex-shrink-0">
    <span className="text-orange-500 font-bold text-base sm:text-lg">
      {wordIndex + 1}.
    </span>
    <span className="text-gray-500 text-sm sm:text-base">word</span>
  </div>
  <input
    type="text"
    value={verifyWords[wordIndex] || ''}
    onChange={(e) => setVerifyWords(prev => ({ ...prev, [wordIndex]: e.target.value }))}
    className="flex-1 min-w-0 px-4 sm:px-5 py-3 sm:py-4 bg-white border-2 border-gray-200 rounded-xl text-base sm:text-lg focus:outline-none focus:border-orange-500 transition-all placeholder-gray-400"
    placeholder="Enter word"
    autoFocus={idx === 0}
  />
</div>
```

**Changes:**
- ✅ Label width: `w-24 sm:w-28 lg:w-32` → Meer ruimte
- ✅ Gap: `gap-4 sm:gap-5` → Beter spacing
- ✅ Input padding: `px-4 sm:px-5 py-3 sm:py-4` → Groter op desktop
- ✅ Text size: `text-base sm:text-lg` → Responsive

---

### **PHASE 5: VISUAL POLISH**

#### **Fix 5.1: Typography Scale**

**Probleem:** Inconsistente font sizes

**Oplossing:**
```tsx
// NIEUW - Unified typography scale
const TYPOGRAPHY = {
  h1: "text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900",
  h2: "text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900",
  h3: "text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900",
  body: "text-sm sm:text-base lg:text-lg text-gray-600",
  small: "text-xs sm:text-sm text-gray-500",
};

// Gebruik:
<h1 className={TYPOGRAPHY.h1}>Welcome to Blaze</h1>
<h2 className={TYPOGRAPHY.h2}>Create a wallet</h2>
<p className={TYPOGRAPHY.body}>Choose how you want to create your wallet</p>
```

**Changes:**
- ✅ Consistent typography scale
- ✅ Responsive sizing
- ✅ Herbruikbaar

#### **Fix 5.2: Icon Sizes**

**Probleem:** Icons verschillende sizes

**Oplossing:**
```tsx
// NIEUW - Consistent icon sizes
const ICON_SIZES = {
  small: "w-4 h-4 sm:w-5 sm:h-5",
  medium: "w-5 h-5 sm:w-6 sm:h-6",
  large: "w-6 h-6 sm:w-8 sm:h-8",
  xlarge: "w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12",
};

// Gebruik:
<Mail className={ICON_SIZES.medium} />
<Shield className={ICON_SIZES.large} />
```

---

### **PHASE 6: UX FLOW IMPROVEMENTS**

#### **Fix 6.1: Skip Carousel Option**

**Probleem:** Users moeten door 4 carousel pages

**Oplossing:**
```tsx
// NIEUW - Skip button op carousel
{step === 'carousel' && (
  <div className="absolute top-4 right-4 z-20">
    <button
      onClick={() => setStep('create-options')}
      className="px-3 py-1.5 text-xs sm:text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
    >
      Skip intro
    </button>
  </div>
)}
```

**Changes:**
- ✅ Skip button → Users kunnen direct naar wallet creation
- ✅ Positioned absolute → Niet in de weg
- ✅ Subtle styling → Niet opvallend maar wel zichtbaar

#### **Fix 6.2: Progress Indicator**

**Probleem:** Users weten niet waar ze zijn in flow

**Oplossing:**
```tsx
// NIEUW - Progress indicator component
const OnboardingProgress = ({ currentStep, totalSteps }) => {
  const steps = ['Welcome', 'Create/Import', 'Setup', 'Complete'];
  const currentIndex = steps.indexOf(currentStep);
  
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`h-2 rounded-full transition-all ${
            index <= currentIndex
              ? 'bg-orange-500 w-8'
              : 'bg-gray-200 w-2'
          }`}
        />
      ))}
    </div>
  );
};
```

**Changes:**
- ✅ Visual progress → Users weten waar ze zijn
- ✅ Subtle → Niet opvallend
- ✅ Helpful → Betere UX

---

## 📋 IMPLEMENTATION CHECKLIST

### **Priority 1: Critical (Do First)**
- [ ] Fix desktop centering (Fix 1.1)
- [ ] Fix welcome screen container (Fix 1.2)
- [ ] Fix floating icons responsive (Fix 1.3)
- [ ] Fix carousel content height (Fix 1.4)
- [ ] Implement unified spacing system (Fix 2.1)
- [ ] Implement button consistency (Fix 2.2)

### **Priority 2: Important (Do Next)**
- [ ] Fix form container width (Fix 3.1)
- [ ] Fix form field spacing (Fix 3.2)
- [ ] Redesign social buttons (Fix 3.3)
- [ ] Fix textarea height (Fix 4.1)
- [ ] Fix mnemonic grid layout (Fix 4.2)
- [ ] Fix verify input layout (Fix 4.3)

### **Priority 3: Polish (Do Last)**
- [ ] Implement typography scale (Fix 5.1)
- [ ] Implement icon sizes (Fix 5.2)
- [ ] Add skip carousel option (Fix 6.1)
- [ ] Add progress indicator (Fix 6.2)

---

## 🎨 DESIGN SYSTEM UPDATES

### **Spacing Scale**
```tsx
const SPACING = {
  xs: '4px',    // 1 unit
  sm: '8px',    // 2 units
  md: '12px',   // 3 units
  lg: '16px',   // 4 units
  xl: '24px',   // 6 units
  '2xl': '32px', // 8 units
  '3xl': '48px', // 12 units
};
```

### **Breakpoints**
```tsx
const BREAKPOINTS = {
  mobile: '0px',      // Base
  tablet: '640px',    // sm
  desktop: '1024px',  // lg
  large: '1280px',    // xl
};
```

### **Color Palette**
```tsx
const COLORS = {
  primary: {
    gradient: 'from-orange-500 to-yellow-500',
    hover: 'from-orange-600 to-yellow-600',
  },
  secondary: {
    bg: 'bg-white',
    border: 'border-gray-200',
    hover: 'hover:bg-gray-50',
  },
  text: {
    primary: 'text-gray-900',
    secondary: 'text-gray-600',
    tertiary: 'text-gray-500',
  },
};
```

---

## 🚀 EXPECTED RESULTS

### **Before:**
- ❌ Content niet gecentreerd op desktop
- ❌ Inconsistente spacing
- ❌ Verschillende button stijlen
- ❌ Forms te smal
- ❌ Rommelige layout

### **After:**
- ✅ Perfect gecentreerd op alle screen sizes
- ✅ Consistent spacing system
- ✅ Unified button styles
- ✅ Optimale form widths
- ✅ Professionele, clean layout
- ✅ Betere UX flow
- ✅ Visual polish

---

## 📝 NOTES

- **Mobile First:** Alle fixes zijn mobile-first, dan responsive naar desktop
- **Consistency:** Alle screens gebruiken hetzelfde design system
- **Accessibility:** Alle interactive elements hebben proper focus states
- **Performance:** Geen performance impact, alleen CSS changes

---

**Status:** Ready for Implementation  
**Estimated Time:** 4-6 hours  
**Priority:** 🔴 CRITICAL

