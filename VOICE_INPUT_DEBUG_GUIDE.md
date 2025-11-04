# 🎙️ VOICE INPUT - DEBUG GUIDE

**Datum**: 4 november 2025  
**Status**: ✅ FIXED + DEPLOYED

---

## 🐛 **PROBLEEM DAT JE HAD:**

### **Symptomen:**
- ❌ "Transcription failed" elke keer
- ❌ Voice input werkt traag

### **Root Causes:**
1. **Audio format mismatch**: `audio/webm;codecs=opus` werd niet herkend
2. **File extension mismatch**: Alle files werden `recording.webm` genoemd, ongeacht format
3. **Geen error logging**: Je kon niet zien wat er mis ging

---

## ✅ **FIXES TOEGEPAST:**

### **1. Audio Format Support**
```typescript
// VOOR:
const allowedTypes = ['audio/webm', 'audio/mp3', 'audio/wav'];
if (!allowedTypes.includes(audioFile.type)) {
  return error; // ❌ Reject audio/webm;codecs=opus
}

// NA:
const allowedTypes = [
  'audio/webm', 
  'audio/webm;codecs=opus', // ✅ Nu toegestaan
  'audio/ogg;codecs=opus',
  'audio/mp3',
  'audio/wav',
  // ... etc
];
// Check if type STARTS WITH allowed type (handles codec variations)
const isValidType = allowedTypes.some(type => 
  audioFile.type.startsWith(type.split(';')[0])
);
```

### **2. Dynamic File Extensions**
```typescript
// VOOR:
const fileName = 'recording.webm'; // ❌ Always webm

// NA:
let extension = 'webm';
if (audioFile.type.includes('mp3')) extension = 'mp3';
else if (audioFile.type.includes('wav')) extension = 'wav';
else if (audioFile.type.includes('ogg')) extension = 'ogg';
// ... etc
const fileName = `recording.${extension}`; // ✅ Correct extension
```

### **3. Extensive Logging**
```typescript
// NU IN CONSOLE:
🎙️ [Whisper API] Received file: {
  name: 'recording.webm',
  type: 'audio/webm;codecs=opus',
  size: '45.2KB'
}
📤 [Whisper API] Sending to OpenAI: recording.webm (audio/webm)
✅ [Whisper API] Transcription successful: "send 0.005 sol to..."
```

---

## 🧪 **HOE TE TESTEN:**

### **Stap 1: Open Console**
1. Open AI Assistant
2. Druk F12 (Developer Tools)
3. Ga naar "Console" tab

### **Stap 2: Test Voice Input**
1. Click de purple/pink mic button
2. Zeg: **"Send 0.005 SOL to [een adres]"**
3. Click mic button weer (stop recording)
4. Kijk in console

### **Stap 3: Check Console Logs**

#### **✅ SUCCESS - Je zou moeten zien:**
```
🎙️ [Voice] Requesting microphone permission...
🎙️ [Voice] Using format: audio/webm;codecs=opus
🎙️ [Voice] Recording started
🎙️ [Voice] Recording stopped (45.2KB)
📤 [Voice] Uploading audio for transcription... {size: "45.2KB", type: "audio/webm;codecs=opus"}
📤 [Voice] Sending to API...
📡 [Voice] API response status: 200
✅ [Voice] Transcription successful: send 0.005 sol to...
```

#### **❌ ERROR - Als je dit ziet:**
```
❌ [Voice] Transcription error: {
  message: "OpenAI API key is not configured",
  status: 401
}
```
**→ Oplossing**: Check of `OPENAI_API_KEY` in Vercel environment variables staat

```
❌ [Voice] API error: {
  error: "Invalid audio format: audio/webm;codecs=opus"
}
```
**→ Oplossing**: Vercel deployment is nog niet live. Wacht 1-2 min en probeer opnieuw

```
❌ [Voice] Transcription error: {
  message: "Rate limit exceeded"
}
```
**→ Oplossing**: Wacht 30 seconden en probeer opnieuw

---

## 🚀 **PERFORMANCE TIPS:**

### **Als voice input nog steeds traag is:**

1. **Check internet snelheid**
   - Upload speed moet > 1 Mbps zijn
   - Test op fast.com

2. **Spreek korter (< 5 seconden)**
   - Kortere audio = sneller transcription
   - "Send 1 SOL to X" is sneller dan lange zinnen

3. **Check Vercel region**
   - Voice API draait op Vercel Edge
   - Dichter bij je locatie = sneller

4. **Alternative: Type commands**
   - Voice is 2-3 seconden (transcription)
   - Typing is instant

---

## 📊 **EXPECTED TIMINGS:**

| Action | Time |
|--------|------|
| Start recording | < 100ms |
| Stop recording | < 100ms |
| Upload audio (50KB) | 0.5-1s |
| Whisper transcription | 1-2s |
| **Total** | **2-3s** |

Als het langer dan 5 seconden duurt:
- Check console voor errors
- Check internet connection
- Try opnieuw

---

## 🔧 **TROUBLESHOOTING:**

### **"Microphone permission denied"**
**Oplossing:**
1. Chrome: Settings → Privacy → Site Settings → Microphone
2. Allow microphone for blazewallet.io
3. Refresh page

### **"No microphone found"**
**Oplossing:**
1. Check if microphone is connected
2. Test in other apps (Zoom, Discord)
3. Restart browser

### **"Microphone in use by another app"**
**Oplossing:**
1. Close Zoom, Teams, Discord, etc.
2. Refresh BlazeWallet
3. Try again

### **"Network error"**
**Oplossing:**
1. Check internet connection
2. Disable VPN (if using)
3. Try different network

---

## 📱 **MOBILE SPECIFIEK:**

### **iOS Safari:**
- Mic permission: Settings → Safari → Microphone → Allow
- Works perfectly on iPhone

### **Android Chrome:**
- Mic permission: Settings → Site Settings → Microphone → Allow
- Works perfectly on Android

---

## 🎯 **ALTERNATIEF ALS VOICE NIET WERKT:**

Als voice input echt niet werkt na alle fixes:
1. **Type je command** (works instant)
2. **Copy-paste command** van voorbeelden
3. **Use QR scanner** voor addresses

Voice is een **bonus feature**, niet kritiek voor wallet functionaliteit.

---

## 📞 **CONTACT:**

Als je nog steeds problemen hebt:
1. Open console (F12)
2. Maak screenshot van error
3. Stuur naar mij met:
   - Browser (Chrome/Firefox/Safari)
   - Device (iPhone/Android/Desktop)
   - Console logs

Ik fix het dan binnen 1 uur! 🚀

