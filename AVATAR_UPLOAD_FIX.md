# 🔧 AVATAR UPLOAD FIX - RLS POLICY

## ⚠️ PROBLEEM
Avatar upload faalt met error:
```
new row violates row-level security policy
POST /storage/v1/object/user-uploads/avatars/{file} 400
```

## 🎯 OORZAAK
De oude RLS policy verwachtte deze folder structure:
```
avatars/{user_id}/{filename}
```

Maar de code uploadt naar:
```
avatars/{user_id}-{timestamp}.{ext}
```

## ✅ OPLOSSING
Run de migration: `supabase/migrations/20260201000000_fix_avatar_upload_rls.sql`

## 📋 HOE TE RUNNEN

### Optie 1: Supabase Dashboard (MAKKELIJKST)
1. Ga naar: https://supabase.com/dashboard/project/ldehmephukevxumwdbwt
2. Klik op "SQL Editor" in de sidebar
3. Klik op "New query"
4. Plak de hele inhoud van `supabase/migrations/20260201000000_fix_avatar_upload_rls.sql`
5. Klik op "Run" (of CMD+Enter)
6. ✅ Done!

### Optie 2: Supabase CLI
```bash
# Als je Supabase CLI hebt geïnstalleerd:
cd "/Users/rickschlimback/Desktop/BLAZE Wallet 29-12"
supabase db push
```

## 🔍 WAT DOET DE MIGRATION?

### 1. Drop oude policies (3x)
- `Users can upload their own avatar`
- `Users can delete their own avatar`
- `Anyone can view avatars`

### 2. Create nieuwe policies (5x)

#### Upload Policy
```sql
CREATE POLICY "Users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND name LIKE 'avatars/' || auth.uid()::text || '%'
);
```

#### Update Policy (voor upsert)
```sql
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND name LIKE 'avatars/' || auth.uid()::text || '%'
);
```

#### View Policy (public)
```sql
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
);
```

#### Delete Policy
```sql
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND name LIKE 'avatars/' || auth.uid()::text || '%'
);
```

#### Service Role Policy
```sql
CREATE POLICY "Service role full access to user-uploads"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'user-uploads');
```

### 3. Update bucket configuration
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-uploads',
  'user-uploads',
  true,
  5242880, -- 5MB limit (was 2MB in code)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) 
DO UPDATE SET...
```

## 🎉 RESULTAAT

Na het runnen van de migration:
- ✅ Avatar upload werkt
- ✅ RLS policy matcht code pattern
- ✅ Public viewing werkt
- ✅ Users kunnen eigen avatars deleten
- ✅ Service role heeft full access
- ✅ 5MB file size limit
- ✅ Correcte MIME types

## 📁 FILE STRUCTURE

```
user-uploads/
  └── avatars/
      ├── 5a39e19c-f663-4226-b5d5-26c032692865-1769951642783.png
      ├── 7b42f20d-a123-4567-c890-12345678901-1769952000000.jpg
      └── ...
```

## 🔐 SECURITY

De nieuwe policies zijn veilig omdat:
1. ✅ Alleen authenticated users kunnen uploaden
2. ✅ Users kunnen alleen hun eigen avatars uploaden/deleten
3. ✅ Pattern matching op `auth.uid()` in filename
4. ✅ Public viewing is OK (avatars zijn publiek)
5. ✅ Service role heeft admin access voor backend operations

## 🧪 TESTEN

Na het runnen van de migration:
1. Log in op my.blazewallet.io
2. Ga naar Account Settings
3. Klik op camera icon bij avatar
4. Upload een foto (max 5MB)
5. ✅ Zou moeten werken!

## 📝 COMMIT INFO

**Commit:** `ac4c74d4`  
**Branch:** `main`  
**File:** `supabase/migrations/20260201000000_fix_avatar_upload_rls.sql`

