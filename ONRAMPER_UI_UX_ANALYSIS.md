# 🔍 Onramper UI/UX Analyse - Volledig Binnen Blaze

## 📊 HUIDIGE SITUATIE

### ❌ Wat We Nu Hebben:
1. **BuyModal3** gebruikt een **iframe** voor Onramper widget (regel 451-457)
2. **Payment providers** (Mollie, Stripe, etc.) kunnen **NIET** in iframes (X-Frame-Options: deny)
3. **KYC verificatie** gebeurt in Onramper widget (niet in Blaze)

### ⚠️ Problemen:
- **Iframe beperkingen**: Payment providers blokkeren iframe embedding
- **KYC herhaling**: Gebruikers moeten bij elke transactie KYC doen
- **UX inconsistentie**: Onramper widget heeft eigen styling

---

## ✅ OPLOSSINGEN

### **OPTIE 1: Hybrid Approach (AANBEVOLEN)** ⭐

**Wat:**
- **Custom UI** voor selectie (amount, crypto, payment method) - ✅ AL GEDAAN
- **Popup window** voor payment provider (Mollie, Stripe, etc.)
- **Webhook** voor status updates
- **Geen iframe** voor payment providers

**Voordelen:**
- ✅ Volledige controle over selectie UI
- ✅ Payment providers werken in popup (geen iframe issues)
- ✅ Gebruiker blijft in Blaze context
- ✅ Minimale code changes

**Implementatie:**
```typescript
// In BuyModal3.tsx - vervang iframe met popup
const handleContinue = async () => {
  // ... create transaction ...
  
  if (data.success && data.transaction?.paymentUrl) {
    // Open payment URL in centered popup
    const popup = window.open(
      data.transaction.paymentUrl,
      'onramper-payment',
      'width=600,height=800,left=400,top=100'
    );
    
    // Monitor popup for completion
    const checkPopup = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkPopup);
        // Check webhook status or poll API
        checkTransactionStatus(transactionId);
      }
    }, 1000);
  }
};
```

---

### **OPTIE 2: Volledig Custom UI (MEER WERK)**

**Wat:**
- Volledig custom UI zonder Onramper widget
- Direct API calls naar Onramper
- Payment provider redirect in popup
- KYC via Onramper API (indien mogelijk)

**Voordelen:**
- ✅ 100% Blaze UI/UX
- ✅ Geen externe widgets
- ✅ Volledige controle

**Nadelen:**
- ⚠️ Veel meer code nodig
- ⚠️ KYC moet nog steeds via Onramper
- ⚠️ Payment providers moeten nog steeds in popup

**Status:** Onramper heeft geen volledige API voor custom KYC flow - widget is vereist voor compliance.

---

## 🔐 KYC VERIFICATIE IN BLAZE

### **Huidige Situatie:**
- Onramper doet KYC zelf (compliance vereiste)
- Gebruikers moeten bij elke transactie KYC doen
- Geen mogelijkheid om KYC volledig over te slaan

### **Wat We WEL Kunnen Doen:**

#### **1. Pre-fill User Data** ✅
```typescript
// Via partnerContext parameter
const partnerContext = {
  userId: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  // ... andere data
};

// In widget URL
const widgetUrl = `https://buy.onramper.com?apiKey=...&partnerContext=${encodeURIComponent(JSON.stringify(partnerContext))}`;
```

**Voordelen:**
- ✅ Gebruiker hoeft data niet opnieuw in te voeren
- ✅ Sneller KYC proces
- ✅ Betere UX

#### **2. KYC Status Tracking** ✅
```typescript
// In Supabase: user_profiles table
interface UserProfile {
  onramper_kyc_status: 'none' | 'pending' | 'verified' | 'rejected';
  onramper_kyc_date: Date | null;
  onramper_user_id: string | null;
}

// Check before showing buy modal
if (user.onramper_kyc_status === 'verified') {
  // Skip KYC screen in widget (via partnerContext)
}
```

**Voordelen:**
- ✅ Track KYC status per gebruiker
- ✅ Skip KYC screen als al verified
- ✅ Betere UX voor repeat users

#### **3. Onramper User ID Linking** ✅
```typescript
// Via webhook: link Onramper user ID to Blaze user
// In webhook handler:
if (payload.status === 'COMPLETED') {
  await supabase
    .from('user_profiles')
    .update({
      onramper_kyc_status: 'verified',
      onramper_user_id: payload.onrampTransactionId,
      onramper_kyc_date: new Date(),
    })
    .eq('user_id', userId);
}
```

**Voordelen:**
- ✅ Automatische KYC status updates
- ✅ Link tussen Blaze en Onramper users
- ✅ Skip KYC voor verified users

---

## 🎯 AANBEVOLEN IMPLEMENTATIE

### **FASE 1: Popup voor Payment (Quick Win)** ✅

**Doel:** Vervang iframe met popup voor payment providers

**Wijzigingen:**
1. Update `BuyModal3.tsx` - vervang iframe met popup window
2. Monitor popup voor completion
3. Poll API of check webhook voor status

**Tijd:** ~1-2 uur

---

### **FASE 2: KYC Pre-fill & Tracking** ✅

**Doel:** Pre-fill user data en track KYC status

**Wijzigingen:**
1. Add `onramper_kyc_status` to `user_profiles` table
2. Pre-fill user data via `partnerContext`
3. Update webhook handler om KYC status te tracken
4. Skip KYC screen voor verified users

**Tijd:** ~2-3 uur

---

### **FASE 3: Volledig Custom UI (Optioneel)** ⚠️

**Doel:** Volledig custom UI zonder Onramper widget

**Status:** **NIET MOGELIJK** - Onramper vereist widget voor KYC compliance

**Alternatief:** Gebruik Onramper widget alleen voor KYC, rest custom UI

---

## 📋 CONCLUSIE

### ✅ **Wat We Kunnen Doen:**
1. **Popup voor payment** (geen iframe issues)
2. **Pre-fill user data** (sneller KYC)
3. **Track KYC status** (skip voor verified users)
4. **Custom selectie UI** (al gedaan!)

### ❌ **Wat We NIET Kunnen Doen:**
1. **KYC volledig in Blaze** - Onramper vereist widget voor compliance
2. **Payment providers in iframe** - X-Frame-Options: deny
3. **Volledig custom UI zonder widget** - KYC compliance vereiste

### 🎯 **Beste Aanpak:**
1. **Custom UI** voor selectie (✅ al gedaan)
2. **Popup window** voor payment (geen iframe)
3. **Pre-fill + tracking** voor KYC (sneller proces)
4. **Webhook** voor status updates (✅ al gedaan)

---

## 🚀 VOLGENDE STAPPEN

1. **Implementeer popup window** voor payment providers
2. **Add KYC tracking** in database
3. **Pre-fill user data** via partnerContext
4. **Test volledige flow**

**Totaal geschatte tijd:** 3-5 uur

