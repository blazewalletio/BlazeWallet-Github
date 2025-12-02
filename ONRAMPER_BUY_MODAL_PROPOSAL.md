# 🎨 ONRAMPER BUY MODAL - PERFECT VOORSTEL

## 📋 OVERZICHT

Dit document beschrijft het **perfecte voorstel** voor de custom Onramper Buy Modal die **100% naadloos** aansluit bij de huidige Blaze Wallet styling (Send, Receive, Swap modals).

---

## 🎯 STYLING PATTERNS (GEBASEERD OP SEND/RECEIVE/SWAP)

### **1. Header Styling** ✅
```tsx
<div className="mb-6">
  <div className="flex items-center gap-3 mb-2">
    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
      <Flame className="w-6 h-6 text-white" />
    </div>
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Buy crypto</h2>
      <p className="text-sm text-gray-600">
        Purchase crypto with iDEAL, credit card or bank transfer
      </p>
    </div>
  </div>
</div>
```

### **2. Back Button** ✅
```tsx
<button
  onClick={onClose}
  className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
>
  ← Back
</button>
```

### **3. Main Container** ✅
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
>
  <div className="max-w-4xl mx-auto p-6">
    {/* Content */}
  </div>
</motion.div>
```

### **4. Glass Cards** ✅
```tsx
<div className="glass-card p-6 space-y-6">
  {/* Content */}
</div>
```

### **5. Primary Buttons** ✅
```tsx
<button className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl">
  Buy now
</button>
```

### **6. Input Fields** ✅
```tsx
<input
  type="number"
  className="input-field font-mono text-sm"
  placeholder="0.00"
/>
```

---

## 🏗️ COMPONENT STRUCTUUR

### **STAP 1: Amount Selection** (Vergelijkbaar met SendModal)

```tsx
<div className="glass-card p-6 space-y-6">
  {/* Fiat Currency Selector */}
  <div>
    <label className="text-sm font-medium text-gray-900 mb-2 block">
      Pay with
    </label>
    <div className="relative">
      <button
        onClick={() => setShowFiatDropdown(!showFiatDropdown)}
        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">€</span>
          <span>EUR</span>
        </div>
        <ChevronDown className="w-5 h-5 text-gray-400" />
      </button>
      
      {showFiatDropdown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden"
        >
          {['EUR', 'USD', 'GBP'].map((fiat) => (
            <button
              key={fiat}
              onClick={() => {
                setSelectedFiat(fiat);
                setShowFiatDropdown(false);
              }}
              className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                selectedFiat === fiat ? 'bg-orange-50' : ''
              }`}
            >
              <span className="font-medium text-gray-900">{fiat}</span>
              {selectedFiat === fiat && (
                <Check className="w-5 h-5 text-orange-500" />
              )}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  </div>

  {/* Amount Input */}
  <div>
    <div className="flex justify-between items-center mb-2">
      <label className="text-sm font-medium text-gray-900">
        Amount ({selectedFiat})
      </label>
      <span className="text-sm text-gray-600">
        Min: €10 • Max: €10,000
      </span>
    </div>
    <div className="relative">
      <input
        type="number"
        value={fiatAmount}
        onChange={(e) => setFiatAmount(e.target.value)}
        placeholder="0.00"
        step="0.01"
        min="10"
        max="10000"
        className="input-field pr-20 text-2xl font-bold"
      />
      <button
        onClick={handleMaxAmount}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-600 hover:text-orange-700 text-sm font-semibold"
      >
        MAX
      </button>
    </div>
    {/* Quick Amount Buttons */}
    <div className="grid grid-cols-4 gap-2 mt-3">
      {[50, 100, 250, 500].map((amount) => (
        <button
          key={amount}
          onClick={() => setFiatAmount(amount.toString())}
          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
            fiatAmount === amount.toString()
              ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
          }`}
        >
          €{amount}
        </button>
      ))}
    </div>
  </div>

  {/* Crypto Currency Selector */}
  <div>
    <label className="text-sm font-medium text-gray-900 mb-2 block">
      Receive
    </label>
    <div className="relative">
      <button
        onClick={() => setShowCryptoDropdown(!showCryptoDropdown)}
        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
      >
        {selectedCrypto && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {selectedCrypto.charAt(0)}
            </div>
            <span>{selectedCrypto}</span>
          </div>
        )}
        <ChevronDown className="w-5 h-5 text-gray-400" />
      </button>
      
      {showCryptoDropdown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
        >
          {supportedCryptos.map((crypto) => (
            <button
              key={crypto}
              onClick={() => {
                setSelectedCrypto(crypto);
                setShowCryptoDropdown(false);
                fetchQuote();
              }}
              className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                selectedCrypto === crypto ? 'bg-orange-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {crypto.charAt(0)}
                </div>
                <span className="font-medium text-gray-900">{crypto}</span>
              </div>
              {selectedCrypto === crypto && (
                <Check className="w-5 h-5 text-orange-500" />
              )}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  </div>
</div>
```

### **STAP 2: Quote Display** (Vergelijkbaar met SwapModal)

```tsx
{quote && !isLoadingQuote && (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card p-6 space-y-4"
  >
    {/* Main Quote Display */}
    <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200 rounded-xl p-6">
      <div className="text-sm text-gray-600 mb-1">You'll receive</div>
      <div className="text-4xl font-bold text-gray-900 mb-1">
        {quote.cryptoAmount} {selectedCrypto}
      </div>
      <div className="text-sm text-gray-600">
        ≈ {fiatAmount} {selectedFiat}
      </div>
    </div>

    {/* Breakdown */}
    <div className="space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600">Exchange rate</span>
        <span className="font-semibold text-gray-900">
          1 {selectedCrypto} = {quote.exchangeRate} {selectedFiat}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Onramper fee</span>
        <span className="font-semibold text-gray-900">
          {quote.fee} {selectedFiat}
        </span>
      </div>
      <div className="h-px bg-gray-200" />
      <div className="flex justify-between font-semibold text-base">
        <span className="text-gray-900">Total</span>
        <span className="text-gray-900">
          {fiatAmount} {selectedFiat}
        </span>
      </div>
    </div>
  </motion.div>
)}
```

### **STAP 3: Payment Method Selection** (Nieuw, Blaze-styled)

```tsx
<div className="glass-card p-6">
  <label className="text-sm font-medium text-gray-900 mb-4 block">
    Payment method
  </label>
  <div className="space-y-3">
    {paymentMethods.map((method) => (
      <button
        key={method.id}
        onClick={() => setSelectedPaymentMethod(method.id)}
        className={`w-full p-4 rounded-xl text-left border-2 transition-all ${
          selectedPaymentMethod === method.id
            ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-500 shadow-md'
            : 'bg-white border-gray-200 hover:border-orange-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              selectedPaymentMethod === method.id
                ? 'bg-gradient-to-r from-orange-500 to-yellow-500'
                : 'bg-gray-100'
            }`}>
              {method.icon === 'ideal' && <Banknote className={`w-5 h-5 ${
                selectedPaymentMethod === method.id ? 'text-white' : 'text-gray-600'
              }`} />}
              {method.icon === 'card' && <CreditCard className={`w-5 h-5 ${
                selectedPaymentMethod === method.id ? 'text-white' : 'text-gray-600'
              }`} />}
              {method.icon === 'bank' && <Building className={`w-5 h-5 ${
                selectedPaymentMethod === method.id ? 'text-white' : 'text-gray-600'
              }`} />}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{method.name}</div>
              <div className="text-xs text-gray-600">
                {method.processingTime} • Fee: {method.fee}
              </div>
            </div>
          </div>
          {selectedPaymentMethod === method.id && (
            <Check className="w-5 h-5 text-orange-500" />
          )}
        </div>
      </button>
    ))}
  </div>
</div>
```

### **STAP 4: Review & Confirm** (Vergelijkbaar met SendModal confirm step)

```tsx
{step === 'confirm' && (
  <div className="space-y-6">
    {/* Main Amount Display */}
    <div className="glass-card p-6 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200">
      <div className="text-sm text-gray-600 mb-1">You're buying</div>
      <div className="text-4xl font-bold text-gray-900 mb-1">
        {quote.cryptoAmount} {selectedCrypto}
      </div>
      <div className="text-sm text-gray-600">
        ≈ {fiatAmount} {selectedFiat}
      </div>
    </div>

    {/* Details */}
    <div className="glass-card p-6 space-y-4 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600">Payment method</span>
        <span className="font-medium text-gray-900">{selectedPaymentMethodName}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Exchange rate</span>
        <span className="font-medium text-gray-900">
          1 {selectedCrypto} = {quote.exchangeRate} {selectedFiat}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Fee</span>
        <span className="font-medium text-gray-900">{quote.fee} {selectedFiat}</span>
      </div>
      <div className="h-px bg-gray-200" />
      <div className="flex justify-between font-semibold text-base">
        <span className="text-gray-900">Total</span>
        <span className="text-gray-900">{fiatAmount} {selectedFiat}</span>
      </div>
    </div>

    {/* Buttons */}
    <div className="flex gap-3">
      <button
        onClick={() => setStep('input')}
        className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
      >
        Back
      </button>
      <button
        onClick={handleCreateTransaction}
        className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
      >
        Continue to payment
      </button>
    </div>
  </div>
)}
```

### **STAP 5: Payment Redirect** (Nieuw)

```tsx
{step === 'payment' && transaction && (
  <div className="glass-card p-12 text-center">
    <Loader2 className="w-16 h-16 animate-spin text-orange-500 mx-auto mb-4" />
    <h3 className="text-xl font-semibold text-gray-900 mb-2">Redirecting to payment...</h3>
    <p className="text-gray-600 mb-6">
      You'll be redirected to complete your payment securely
    </p>
    <button
      onClick={() => window.open(transaction.paymentUrl, '_blank')}
      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
    >
      Open payment page
    </button>
  </div>
)}
```

### **STAP 6: Status Tracking** (Nieuw, met webhook updates)

```tsx
{step === 'processing' && transaction && (
  <div className="glass-card p-12 text-center">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full mx-auto mb-4"
    />
    <h3 className="text-xl font-semibold text-gray-900 mb-2">
      {transactionStatus === 'PENDING' && 'Payment pending...'}
      {transactionStatus === 'PROCESSING' && 'Processing your purchase...'}
      {transactionStatus === 'COMPLETED' && 'Purchase completed!'}
    </h3>
    <p className="text-gray-600 mb-6">
      {transactionStatus === 'PENDING' && 'Waiting for payment confirmation'}
      {transactionStatus === 'PROCESSING' && 'Your crypto is being sent to your wallet'}
      {transactionStatus === 'COMPLETED' && 'Your crypto has been sent successfully'}
    </p>
    
    {transactionStatus === 'COMPLETED' && (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
      </motion.div>
    )}
  </div>
)}
```

---

## 🎨 COMPLETE FLOW

### **Flow Steps:**
1. **Amount Selection** → User kiest fiat amount en crypto
2. **Quote Display** → Real-time quote met breakdown
3. **Payment Method** → User kiest iDEAL/credit card/bank
4. **Review & Confirm** → User bevestigt details
5. **Payment Redirect** → Redirect naar Onramper payment
6. **Status Tracking** → Real-time status updates via webhook

---

## 📱 RESPONSIVE DESIGN

### **Mobile:**
- `max-w-4xl` → `max-w-full px-4`
- Cards: `p-6` → `p-4`
- Buttons: `py-4` → `py-3`
- Text: `text-2xl` → `text-xl`

### **Desktop:**
- Full width binnen `max-w-4xl`
- Spacing: `space-y-6`
- Padding: `p-6`

---

## 🔄 STATE MANAGEMENT

```typescript
const [step, setStep] = useState<'input' | 'confirm' | 'payment' | 'processing'>('input');
const [fiatAmount, setFiatAmount] = useState('');
const [selectedFiat, setSelectedFiat] = useState('EUR');
const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
const [quote, setQuote] = useState<Quote | null>(null);
const [isLoadingQuote, setIsLoadingQuote] = useState(false);
const [transaction, setTransaction] = useState<Transaction | null>(null);
const [transactionStatus, setTransactionStatus] = useState<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>('PENDING');
const [error, setError] = useState('');
```

---

## 🎯 EXACTE STYLING MATCH

### **Alle elementen matchen 100% met Send/Receive/Swap:**

✅ **Header:** Identiek aan SendModal/ReceiveModal/SwapModal
✅ **Back Button:** Identiek styling
✅ **Glass Cards:** `glass-card p-6` (exact zelfde)
✅ **Primary Buttons:** `bg-gradient-to-r from-orange-500 to-yellow-500` (exact zelfde)
✅ **Input Fields:** `input-field` class (exact zelfde)
✅ **Dropdowns:** Border-2, hover states, orange accents (exact zelfde)
✅ **Loading States:** `Loader2` met orange-500 (exact zelfde)
✅ **Success States:** Emerald-500 checkmark (exact zelfde)
✅ **Error States:** Red-50 border red-200 (exact zelfde)
✅ **Spacing:** `space-y-6`, `gap-3`, `mb-6` (exact zelfde)
✅ **Typography:** `text-2xl font-bold text-gray-900` (exact zelfde)
✅ **Colors:** Orange-500, yellow-500, gray-900, gray-600 (exact zelfde)

---

## 🚀 IMPLEMENTATIE CHECKLIST

### **API Routes:**
- [ ] `/api/onramper/quotes` - Get real-time quotes
- [ ] `/api/onramper/supported-data` - Get payment methods, currencies
- [ ] `/api/onramper/create-transaction` - Create transaction
- [ ] `/api/onramper/webhook` - Handle status updates (al geïmplementeerd)

### **Components:**
- [ ] `BuyModal.tsx` - Main component (volledig rebuild)
- [ ] Quote display component
- [ ] Payment method selector
- [ ] Status tracker component

### **Styling:**
- [ ] 100% match met SendModal
- [ ] 100% match met ReceiveModal
- [ ] 100% match met SwapModal
- [ ] Responsive design
- [ ] Animations (Framer Motion)

### **Features:**
- [ ] Real-time quote fetching
- [ ] Payment method selection
- [ ] Transaction creation
- [ ] Payment redirect
- [ ] Status tracking (webhook)
- [ ] Error handling
- [ ] Loading states

---

## ✅ CONCLUSIE

Dit voorstel zorgt voor een **100% perfecte match** met de huidige Blaze Wallet styling:

- ✅ Identieke header styling
- ✅ Identieke card styling
- ✅ Identieke button styling
- ✅ Identieke input styling
- ✅ Identieke dropdown styling
- ✅ Identieke loading/success/error states
- ✅ Identieke spacing en typography
- ✅ Identieke color scheme (orange-yellow gradients)

**Het zal er uitzien alsof het altijd al onderdeel was van Blaze Wallet!** 🔥

---

**Klaar om te implementeren zodra je goedkeuring geeft!** ✨

