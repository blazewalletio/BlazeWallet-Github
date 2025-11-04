# 🔑 SEPARATE API KEYS SETUP - COMPLETE

## ✅ **WAAROM 2 API KEYS?**

**Problem:** 
- OpenAI rate limits gelden voor hele account
- Whisper (voice) + GPT-4o-mini (AI) delen dezelfde limits
- Als voice rate limit bereikt, werkt AI Assistant ook niet meer

**Solution:**
- 2 separate API keys
- **WHISPER_API_KEY**: Alleen voor voice transcription
- **OPENAI_API_KEY**: Alleen voor AI Assistant (GPT)
- Rate limits zijn nu gescheiden!

---

## 📋 **SETUP STAPPEN:**

### **STAP 1: Maak nieuwe OpenAI API key** ✅
1. Ga naar: https://platform.openai.com/api-keys
2. Click **"+ Create new secret key"**
3. Name: `Blaze Wallet - Whisper Voice Input`
4. Permissions: `All`
5. **KOPIEER DE KEY** (je ziet hem maar 1x!)

Key format: `sk-proj-xxxxxxxxxxxx`

---

### **STAP 2: Add key to Vercel** ✅

#### **Via Vercel Dashboard:**
1. Ga naar: https://vercel.com/your-project/settings/environment-variables
2. Click **"Add New"**
3. Vul in:
   ```
   Key:   WHISPER_API_KEY
   Value: sk-proj-xxxxxxxxxxxxxxxx  (de nieuwe key)
   Environment: ✓ Production ✓ Preview ✓ Development
   ```
4. Click **Save**

#### **Via Vercel CLI (alternative):**
```bash
vercel env add WHISPER_API_KEY production
# Paste your key when prompted

vercel env add WHISPER_API_KEY preview
vercel env add WHISPER_API_KEY development
```

---

### **STAP 3: Update lokale .env.local** ✅

Voor lokale development:

```bash
# .env.local (in project root)

# AI Assistant (GPT-4o-mini)
OPENAI_API_KEY=sk-proj-...a0A

# Voice Input (Whisper-1)
WHISPER_API_KEY=sk-proj-...xxx  # NEW!
```

---

### **STAP 4: Redeploy** ✅

```bash
# Push changes to trigger Vercel deployment
git add -A
git commit -m "feat: Separate Whisper API key"
git push origin main

# Or manual redeploy in Vercel Dashboard
```

---

## 🧪 **VERIFICATIE:**

### **Check 1: Vercel Logs**
Na deployment, check Vercel logs voor:
```
🔑 [Whisper API] Using dedicated WHISPER_API_KEY ✅
```

Als je dit ziet:
```
🔑 [Whisper API] Using fallback OPENAI_API_KEY ❌
```
→ Dan is `WHISPER_API_KEY` niet correct ingesteld in Vercel.

### **Check 2: Test Voice Input**
1. Open AI Assistant
2. Click mic button
3. Spreek een command
4. Check console → zou moeten werken zonder 429 errors

---

## 📊 **RATE LIMITS (per API key):**

### **Free Tier:**
- **GPT-4o-mini**: 500 requests/day, 10,000 tokens/min
- **Whisper-1**: 3 requests/min, 50 requests/day

### **Tier 1 ($5+ spent):**
- **GPT-4o-mini**: 10,000 requests/day, 30,000 tokens/min
- **Whisper-1**: 50 requests/min, 500 requests/day

### **Met 2 keys:**
```
AI Assistant:  500 queries/day  (eigen limit)
Voice Input:   50 transcriptions/day (eigen limit)
TOTAL:         550 operations/day ✅
```

### **Met 1 key (oud):**
```
AI + Voice:    50 operations/day (gedeeld) ❌
```

---

## 🎯 **VOORDELEN:**

| Aspect | 1 API Key (oud) | 2 API Keys (nieuw) |
|--------|-----------------|---------------------|
| **Rate Limits** | Gedeeld ❌ | Gescheiden ✅ |
| **Error Isolation** | Als 1 faalt, beide down ❌ | Onafhankelijk ✅ |
| **Cost Tracking** | 1 billing ❌ | Per feature ✅ |
| **Scalability** | Limited ❌ | Better ✅ |

---

## 🔧 **TROUBLESHOOTING:**

### **"Using fallback OPENAI_API_KEY" in logs**
**Problem:** `WHISPER_API_KEY` is niet ingesteld in Vercel

**Fix:**
1. Check Vercel Dashboard → Environment Variables
2. Verify `WHISPER_API_KEY` exists voor alle environments
3. Redeploy project

---

### **"API key invalid" error**
**Problem:** Key is verkeerd gekopieerd of disabled

**Fix:**
1. Check OpenAI Dashboard → API Keys
2. Verify key is **niet revoked**
3. Copy-paste opnieuw (let op spaties!)
4. Update in Vercel
5. Redeploy

---

### **Still getting 429 errors**
**Problem:** Te veel requests in korte tijd

**Fix:**
1. Wacht 1-2 minuten
2. Gebruik text input als alternatief
3. Check OpenAI Dashboard → Usage
4. Consider upgrade naar Tier 1 ($5 prepaid)

---

## 💰 **KOSTEN IMPACT:**

### **Before (1 key):**
```
10,000 users × 1 voice command/day = 10k transcriptions/day
Cost: 10k × $0.0006 = $6/day = $180/month
```

### **After (2 keys):**
```
Same cost, but:
✅ Better reliability (no shared rate limits)
✅ Better error tracking
✅ Can disable voice without breaking AI
✅ Can upgrade only Whisper tier if needed
```

---

## 🚀 **NEXT STEPS:**

1. ✅ Maak nieuwe API key in OpenAI
2. ✅ Add `WHISPER_API_KEY` to Vercel
3. ✅ Code is already updated (automatic!)
4. ✅ Redeploy via git push
5. ✅ Test voice input
6. ✅ Check logs voor "Using dedicated WHISPER_API_KEY"

**Status:** Ready to deploy! 🎉

