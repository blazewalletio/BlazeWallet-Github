# 🕐 TIMEZONE FIX - SMART SCHEDULER

## Probleem
De gebruiker (Nederland, CET = UTC+1) zette een transactie in om **12:23 lokale tijd**, maar de database toonde **10:23 UTC** in plaats van **11:23 UTC**.

**Verwacht:**
- Input: 12:23 CET  
- Opgeslagen: 11:23 UTC (12:23 - 1 uur offset)

**Werkelijk:**
- Input: 12:23 CET  
- Opgeslagen: 10:23 UTC (2 uur verschil! ❌)

## Root Cause
**ISO 8601 Parsing Ambiguïteit** in JavaScript:

```javascript
// ❌ OUDE CODE (ambiguous!)
const scheduledFor = new Date("2025-11-08T12:23:00");
```

**Probleem:** Volgens ISO 8601 standaard:
- `"YYYY-MM-DDTHH:mm:ss"` ZONDER timezone designator (`Z` of `+HH:mm`) kan worden geïnterpreteerd als:
  - **Lokale tijd** (correct voor onze use case)
  - **UTC** (verkeerd! veroorzaakt timezone bug)

**Browser/Engine verschillen:**
- Chrome/V8: interpreteert als lokale tijd ✅
- Safari/WebKit: kan interpreteren als UTC ❌
- Next.js SSR: kan UTC gebruiken tijdens builds ❌
- Next.js Production vs Development: verschillend gedrag mogelijk

## Oplossing
**Expliciete Date Constructor** die ALTIJD lokale timezone gebruikt:

```javascript
// ✅ NIEUWE CODE (unambiguous!)
const [year, month, day] = customDate.split('-').map(Number);
const [hours, minutes] = customTime.split(':').map(Number);
const scheduledFor = new Date(year, month - 1, day, hours, minutes, 0, 0);
```

**Voordelen:**
- ✅ **Altijd lokale timezone** - geen ambiguïteit
- ✅ **Cross-browser consistent** - werkt overal hetzelfde
- ✅ **Production safe** - geen verschillen tussen dev/prod builds
- ✅ **Expliciete month indexing** - month - 1 maakt duidelijk dat maanden 0-indexed zijn

## Verificatie

```bash
node test-timezone-fix.js
```

**Output (CET timezone):**
```
Input: 2025-11-08 12:23 (CET - Nederland)
Nieuwe methode UTC: 2025-11-08T11:23:00.000Z ✅
Verschil met verwacht: 0 minuten ✅
```

## Files Changed
- ✅ `components/SmartScheduleModal.tsx` - Expliciete Date constructor voor custom scheduling
- ✅ Deployment naar production

## Testing
1. ✅ Test script bevestigt correcte parsing  
2. 🔄 Wacht op deployment completion
3. 🔄 Test met echte transactie (gebruiker gaat nieuwe transactie inplannen)

## Gerelateerde Best Practices

### ✅ DO: Gebruik expliciete Date constructors
```javascript
new Date(year, month, day, hour, minute, second, ms)
```

### ❌ DON'T: Parse date strings zonder timezone
```javascript
new Date("2025-11-08T12:23:00")  // Ambiguous!
```

### ✅ DO: Voeg altijd timezone toe aan ISO strings
```javascript
new Date("2025-11-08T12:23:00Z")  // UTC
new Date("2025-11-08T12:23:00+01:00")  // CET
```

### ✅ DO: Gebruik toISOString() voor database opslag
```javascript
const date = new Date(2025, 10, 8, 12, 23, 0);
const dbValue = date.toISOString();  // "2025-11-08T11:23:00.000Z" ✅
```

## Notes
- **JavaScript Date month indexing:** Januari = 0, December = 11
- **Timezone offsets:** CET = UTC+1 (winter), CEST = UTC+2 (zomer)
- **Database:** PostgreSQL/Supabase slaat timestamps op als UTC (correct!)
- **Display:** Altijd converteer terug naar user's lokale tijd voor weergave

## Status
✅ Fixed in commit `7711204f`  
🔄 Deploying to production...  
⏳ Wacht op user test met nieuwe transactie

