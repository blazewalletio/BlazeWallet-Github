# 🔧 Address Book Fix - Contacten Niet Zichtbaar

## Probleem
- Contacten staan wel in Supabase ✅
- Contacten worden niet getoond in Blaze wallet ❌

## Oorzaak
**RLS Policy Mismatch**

De RLS policy checkt alleen `auth.uid()` (UUID), maar de app gebruikt `email` als `user_id`.

```
Auth user ID:  5a39e19c-f663-4226-b5d5-26c032692865 (UUID)
Address book:  ricks_@live.nl (email)
❌ NO MATCH → RLS blokkeert de query
```

## Oplossing

### Stap 1: Run Deze SQL in Supabase

Ga naar **Supabase Dashboard** → **SQL Editor** → **New Query** en run:

```sql
-- ============================================================================
-- FIX: Address Book RLS - Support Email-Based User IDs
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.address_book;

-- ✅ CREATE IMPROVED POLICIES - Support both UUID and email

-- SELECT: Users can view contacts where user_id matches EITHER their UUID OR email
CREATE POLICY "Users can view their own contacts"
  ON public.address_book
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = user_id
  );

-- INSERT: Users can insert contacts for themselves (UUID or email)
CREATE POLICY "Users can insert their own contacts"
  ON public.address_book
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = user_id
  );

-- UPDATE: Users can update their own contacts
CREATE POLICY "Users can update their own contacts"
  ON public.address_book
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = user_id
  )
  WITH CHECK (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = user_id
  );

-- DELETE: Users can delete their own contacts
CREATE POLICY "Users can delete their own contacts"
  ON public.address_book
  FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = user_id
  );

-- Ensure RLS is enabled
ALTER TABLE public.address_book ENABLE ROW LEVEL SECURITY;

-- Success message
SELECT '✅ Address Book RLS updated to support email-based user_id!' as message;
```

### Stap 2: Verificatie

Na het runnen van de SQL, refresh je wallet en open de **Contacts** tab. Je contacten zouden nu zichtbaar moeten zijn!

### Stap 3: Test (Optioneel)

Run dit in SQL Editor om te bevestigen dat je contacten zichtbaar zijn:

```sql
-- Test als ingelogde user
SELECT 
  id,
  name,
  chain,
  address,
  user_id
FROM address_book
WHERE user_id = 'ricks_@live.nl';
```

**Verwacht resultaat:** 2 rijen (je 2 contacten)

## Wat Deze Fix Doet

**Voor (oud):**
```sql
-- Alleen UUID matching
USING (auth.uid()::text = user_id)
```

**Na (nieuw):**
```sql
-- UUID OF email matching ✅
USING (
  auth.uid()::text = user_id OR
  (SELECT email FROM auth.users WHERE id = auth.uid()) = user_id
)
```

Nu accepteert de RLS policy **beide**:
- ✅ Records met `user_id` = UUID (`5a39e19c-...`)
- ✅ Records met `user_id` = email (`ricks_@live.nl`)

## Resultaat

Na deze fix:
- ✅ Bestaande contacten (met email als user_id) werken
- ✅ Nieuwe contacten (met UUID als user_id) werken ook
- ✅ Volledig backwards compatible
- ✅ Security blijft intact (users zien alleen hun eigen contacten)
