# 🔍 Address Book Diagnose

## Probleem
Contacten staan wel in Supabase maar worden niet getoond in de Blaze wallet.

## Root Cause
**RLS Policy Mismatch**

### Wat er gebeurt:

1. **Frontend haalt user_id op:**
```typescript
// AddressBook.tsx:51
const userIdentifier = account.email || account.id;  
// → "ricks_@live.nl"
```

2. **Frontend query:**
```typescript
// AddressBook.tsx:77-80
const { data, error } = await supabase
  .from('address_book')
  .select('*')
  .eq('user_id', userId)  // userId = "ricks_@live.nl"
```

3. **RLS Policy check:**
```sql
-- 20260127140000_fix_address_book_rls.sql:24
USING (auth.uid()::text = user_id)
-- auth.uid() = "5a39e19c-f663-4226-b5d5-26c032692865" (UUID)
-- user_id in query = "ricks_@live.nl" (email)
-- ❌ NO MATCH → geen resultaten
```

## Wat er in de Database staat

Check in Supabase:
```sql
SELECT user_id, name, chain, address 
FROM address_book 
WHERE user_id LIKE '%ricks%';
```

**Verwachte uitkomst:**
- Als `user_id` = email (`ricks_@live.nl`) → data bestaat maar RLS blokkeert
- Als `user_id` = UUID → data is met verkeerde user_id opgeslagen

## Oplossingen

### Optie 1: Gebruik auth.uid() in frontend ✅ (Beste)
```typescript
// AddressBook.tsx
const account = getCurrentAccount();
const { data: { user } } = await supabase.auth.getUser();

if (user) {
  setUserId(user.id);  // ✅ UUID van Supabase auth
}
```

### Optie 2: Update RLS policy naar email (minder veilig)
```sql
-- Niet aanbevolen - emails kunnen veranderen
USING (
  auth.uid()::text = user_id OR
  auth.email() = user_id
)
```

### Optie 3: Migreer data in database
```sql
-- Update alle address_book records van email naar UUID
UPDATE address_book
SET user_id = (
  SELECT id::text 
  FROM auth.users 
  WHERE email = address_book.user_id
)
WHERE user_id LIKE '%@%';
```

## Verificatie

### Test 1: Check wat auth.uid() returnt
```javascript
// In browser console op my.blazewallet.io
const { data } = await supabase.auth.getUser();
console.log('Auth user:', data.user);
// Should show: id, email, etc.
```

### Test 2: Check RLS in SQL Editor
```sql
-- Run in Supabase SQL Editor (logged in as test user)
SELECT * FROM address_book;
-- Should return 2 contacts for current user
```

### Test 3: Check raw data (as admin)
```sql
-- Run with service_role key
SELECT user_id, name FROM address_book LIMIT 10;
-- Check format of user_id (UUID vs email)
```
