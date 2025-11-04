# 🔍 HOE VERCEL FUNCTION LOGS TE CHECKEN

## **STAP 1: Open Vercel Dashboard**
1. Ga naar: https://vercel.com/blaze-wallets-projects/blaze-wallet
2. Of: https://vercel.com/dashboard

## **STAP 2: Open Functions Tab**
1. Click op je project: "blaze-wallet"
2. Click op "Functions" in de sidebar
3. Scroll naar: `/api/ai-assistant/transcribe`
4. Click erop

## **STAP 3: Bekijk Real-time Logs**
1. Je ziet nu alle server-side logs
2. Refresh de pagina als nodig
3. Doe een nieuwe voice input test
4. Logs verschijnen direct

## **STAP 4: Check voor deze logging:**

Je MOET deze regels zien (als de code correct deployed is):

```
========================================
🎙️ [Whisper API] NEW TRANSCRIPTION REQUEST
========================================
🔍 [DEBUG] Environment Variables Check:
  - WHISPER_API_KEY exists: true/false
  - OPENAI_API_KEY exists: true/false
  - WHISPER_API_KEY prefix: sk-proj-...
  - OPENAI_API_KEY prefix: sk-proj-...
  - Are they different?: true/false
```

## **STAP 5: Check OpenAI Usage**
Als je 429 krijgt, check ook:
1. https://platform.openai.com/usage
2. Zie je hoeveel Whisper requests je vandaag hebt gedaan
3. Free tier = max 50/dag

---

## **ALTERNATIEF: Via Vercel CLI**

```bash
# Get latest deployment URL
vercel ls

# Then view logs for that deployment
vercel logs https://blaze-wallet-xxx.vercel.app
```

---

**Doe dit nu en plak de Vercel Function logs hier! 🚀**

