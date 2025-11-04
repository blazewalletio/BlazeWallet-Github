# 🔍 DIRECTE ACTIE: CHECK OPENAI USAGE DASHBOARD

## **HET PROBLEEM:**
- ✅ API keys zijn actief en valid
- ❌ Maar je krijgt direct 429 "Too many requests"
- 🤔 Dit betekent: **je OpenAI account zit op rate limit**

---

## **STAP 1: CHECK JE USAGE** ⚠️

Ga DIRECT naar: **https://platform.openai.com/usage**

Check daar:

### **Voor Whisper-1 (Voice Input):**
- Hoeveel requests heb je **VANDAAG** (4 nov 2025) gedaan?
- **Free Tier Limit: 50 requests/dag, 3 requests/minuut**

### **Voor GPT-4o-mini (AI Assistant):**
- Hoeveel requests heb je vandaag gedaan?
- **Free Tier Limit: 500 requests/dag**

---

## **STAP 2: CHECK JE ACCOUNT TIER** 🎯

Ga naar: **https://platform.openai.com/account/limits**

Check:
- **Current Tier:** Free / Tier 1 / Tier 2 / etc?
- **Whisper limits:** 3/min, 50/day (Free) of hoger?

---

## **WAARSCHIJNLIJKE OORZAKEN:**

### **Scenario A: Je hebt al 50 Whisper requests vandaag gedaan**
```
✅ Keys zijn valid
❌ Account daily limit bereikt (50/50)
→ Wacht tot morgen of upgrade naar Tier 1
```

### **Scenario B: Je hebt te veel requests in korte tijd gedaan**
```
✅ Keys zijn valid
❌ Account per-minute limit bereikt (3/min)
→ Wacht 1 minuut en probeer opnieuw
```

### **Scenario C: Je account is op Free Tier zonder spending**
```
✅ Keys zijn valid
❌ Free tier heeft zeer lage limits
→ Add $5 credit → unlock Tier 1 limits
```

---

## **STAP 3: VERCEL FUNCTION LOGS CHECKEN** 🔍

We moeten de **server-side logs** zien om te bevestigen welke key wordt gebruikt.

### **Via Vercel Dashboard:**
1. Ga naar: https://vercel.com
2. Open je project: "blaze-wallet"
3. Click "Deployments" → Latest deployment
4. Click "Functions" tab
5. Find `/api/ai-assistant/transcribe`
6. Refresh, doe een nieuwe voice test
7. **SCREENSHOT DE LOGS EN PLAK HIER**

Je MOET deze regels zien:
```
========================================
🎙️ [Whisper API] NEW TRANSCRIPTION REQUEST
========================================
🔍 [DEBUG] Environment Variables Check:
  - WHISPER_API_KEY exists: true
  - OPENAI_API_KEY exists: true
  - WHISPER_API_KEY prefix: sk-proj-8wH4rHXC5IC8...
  - OPENAI_API_KEY prefix: sk-proj-8wH4rHXC5IC8...
  - Are they different?: true/false
🔑 [Whisper API] Using dedicated WHISPER_API_KEY
```

**Als je deze logs NIET ziet**, dan is de nieuwe code nog niet deployed!

---

## **STAP 4: QUICK FIX - DISABLE VOICE** ⚡

Als je nu direct wilt dat de wallet werkt:

**Tijdelijk voice input uitschakelen:**
- AI Assistant werkt nog steeds (type commands)
- Geen 429 errors meer
- Voice komt later terug

**Wil je dit?** → Ik kan het in 2 minuten fixen

---

## **STAP 5: PERMANENT FIX - UPGRADE ACCOUNT** 💰

**OpenAI Tier 1 unlocks:**
- Whisper: **50 requests/min** (was 3/min) ✅
- Whisper: **500 requests/dag** (was 50/dag) ✅
- GPT-4o-mini: **10,000 requests/dag** (was 500/dag) ✅

**Kosten:** $5 minimum spend
**How:** https://platform.openai.com/account/billing/overview

---

## **WAT IK NU VAN JE NODIG HEB:**

1. **Screenshot van:** https://platform.openai.com/usage
   - Laat Whisper usage van vandaag zien

2. **Screenshot van:** https://platform.openai.com/account/limits
   - Laat je huidige tier limits zien

3. **Screenshot van Vercel Function logs** (zoals hierboven beschreven)
   - Dan zien we welke API key echt wordt gebruikt

4. **Vertel me:**
   - Heb je vandaag al veel voice tests gedaan?
   - Hoe vaak heb je de mic button gebruikt?
   - Zit je op Free tier of heb je al credit toegevoegd?

---

## **MIJN VERWACHTING:**

Ik denk dat je **Free Tier daily limit (50 requests)** hebt bereikt door:
- Meerdere voice tests vandaag
- Of: eerdere tests die niet goed gingen (elke poging telt!)

**De fix:** Upgrade naar Tier 1 ($5) of wacht tot morgen (00:00 UTC reset)

---

**Plak hier je screenshots van Usage + Limits + Vercel logs! 🚀**

