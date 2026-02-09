# 🔍 PROBLEEM ANALYSE - Device Verification Flow

## Probleem 1: "2FA verification cancelled" na succesvolle 2FA

### Waarom dit gebeurt:
1. **SensitiveAction2FAModal** (regel 86): Roept `onSuccess()` aan na succesvolle verificatie
2. **SensitiveAction2FAModal** (regel 89): Roept daarna `handleClose()` aan die de modal sluit
3. **PasswordUnlockModal** (regel 804-808): `onClose` callback zet altijd de error op "2FA verification cancelled", ook al was de verificatie succesvol

### Oplossing:
- `onClose` moet alleen de error zetten als de modal wordt gesloten ZONDER succes
- Of: `onSuccess` moet de modal sluiten zonder `onClose` aan te roepen
- Of: Check in `onClose` of er een success flag is

---

## Probleem 2: "Failed to update device for verification"

### Waarom dit gebeurt:
1. Na 2FA success wordt `strictSignInWithEmail` aangeroepen (regel 358)
2. Als device niet trusted is, probeert het een device update met `verification_code_expires_at` (regel 365, 408)
3. De update faalt mogelijk omdat:
   - De device al bestaat maar met andere data
   - Er is een conflict in de database
   - De update query faalt om een andere reden

### Mogelijke oorzaken:
- Device bestaat al met andere `device_id` of `device_fingerprint`
- Database constraint violation
- RLS policy blokkeert de update

### Oplossing:
- Betere error handling in `strictSignInWithEmail`
- Check of device al bestaat voordat je update doet
- Gebruik upsert in plaats van update

---

## Probleem 3: "Missing required fields" bij code verificatie

### Waarom dit gebeurt:
**API verwacht** (`app/api/verify-device-code/route.ts` regel 18-25):
```typescript
const { userId, email, code, deviceInfo } = await request.json();
if (!userId || !email || !code || !deviceInfo) {
  return { error: 'Missing required fields' }
}
```

**Wat wordt verstuurd** (`components/PasswordUnlockModal.tsx` regel 715-722):
```typescript
const response = await fetch('/api/verify-device-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: verificationCodeData.userId,
    email: verificationCodeData.email,
    code,
    deviceInfo: verificationCodeData.deviceInfo,
  }),
});
```

### Mogelijke oorzaken:
1. `verificationCodeData.deviceInfo` is niet compleet (mist `fingerprint`?)
2. `verificationCodeData.userId` is leeg
3. `verificationCodeData.email` is leeg
4. `code` is niet correct doorgegeven

### Oplossing:
- Check wat er precies in `verificationCodeData` zit
- Zorg dat `deviceInfo.fingerprint` aanwezig is
- Log de request body voor debugging

---

## Probleem 4: Flow na "Failed to update device"

### Wat er gebeurt:
1. Error "Failed to update device for verification" verschijnt
2. Gebruiker moet opnieuw op "Unlock" klikken
3. Dan pas verschijnt de "Verify New Device" modal
4. Email wordt verstuurd
5. Code invullen geeft "Missing required fields"

### Waarom:
- Na de error wordt de flow niet correct hervat
- Device verification modal wordt niet automatisch getoond
- Gebruiker moet handmatig opnieuw proberen

### Oplossing:
- Na "Failed to update device" error, direct de device verification modal tonen
- Of: Retry logic toevoegen
- Of: Betere error recovery

---

## SAMENVATTING VAN FIXES NODIG:

1. **2FA cancelled fix**: `onClose` moet niet de error zetten als success al is aangeroepen
2. **Device update fix**: Betere error handling en upsert gebruiken
3. **Missing fields fix**: Zorg dat alle required fields correct worden verstuurd
4. **Flow fix**: Na device update error, direct device verification modal tonen

