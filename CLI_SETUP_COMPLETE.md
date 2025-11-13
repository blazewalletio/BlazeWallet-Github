# CLI Setup Complete ✅

Alle CLI tools zijn succesvol gekoppeld en werkend.

## Overzicht CLI Status

### 1. GitHub CLI ✅
**Status**: Gekoppeld en werkend
- **Account**: blazewalletio (actief)
- **Protocol**: HTTPS
- **Scopes**: repo, read:org, gist
- **Verificatie**:
```bash
gh auth status
gh repo view
```

### 2. Vercel CLI ✅
**Status**: Gekoppeld aan blaze-wallet project
- **Project**: blaze-wallet
- **Team**: blaze-wallets-projects
- **Production URL**: https://blaze-wallet-blaze-wallets-projects.vercel.app
- **Laatste Deploy**: Building (met security fixes)
- **Verificatie**:
```bash
vercel whoami
vercel ls
vercel inspect
```

### 3. Supabase CLI ✅
**Status**: Gekoppeld aan project
- **Organisatie**: daftmswqkigwqrlkatlw
- **Project**: ldehmephukevxumwdbwt
- **Region**: eu-north-1
- **Linked**: ● (actief)
- **Verificatie**:
```bash
supabase projects list
supabase db push
supabase functions list
```

### 4. AWS CLI ✅
**Status**: Gekoppeld als blaze-wallet-kms-user
- **Account**: 945695383591
- **User**: blaze-wallet-kms-user
- **User ID**: AIDA5YL6WMAT3TYCQR7HL
- **ARN**: arn:aws:iam::945695383591:user/blaze-wallet-kms-user
- **Verificatie**:
```bash
aws sts get-caller-identity
aws kms list-keys
aws kms describe-key --key-id <key-id>
```

## Handig Commando's

### Git & GitHub
```bash
# Status check
git status
gh repo view

# Push naar GitHub
git push origin main

# Pull requests
gh pr list
gh pr create

# Issues
gh issue list
gh issue create
```

### Vercel Deployment
```bash
# Lokale preview
vercel dev

# Deploy naar preview
vercel

# Deploy naar production
vercel --prod

# Logs bekijken
vercel logs

# Environment variables
vercel env ls
vercel env pull .env.local
```

### Supabase
```bash
# Database migraties
supabase db push
supabase db pull
supabase db diff

# Functions
supabase functions deploy
supabase functions list

# Status
supabase status
supabase projects list
```

### AWS KMS
```bash
# Keys lijst
aws kms list-keys

# Key details
aws kms describe-key --key-id alias/blaze-wallet-ephemeral-keys

# Test encryptie
aws kms encrypt \
  --key-id alias/blaze-wallet-ephemeral-keys \
  --plaintext "test" \
  --query CiphertextBlob \
  --output text

# Test decryptie
aws kms decrypt \
  --ciphertext-blob fileb://encrypted.bin \
  --query Plaintext \
  --output text | base64 --decode
```

## Recente Wijzigingen

### Commit: 70841dd4
**Titel**: 🔒 Security Fixes Batch 1: CORS, CSRF, Transak, Toasts

**Wijzigingen**:
1. ✅ CORS Wildcard Fix (CRITICAL-1)
2. ✅ CSRF Protection (CRITICAL-2)
3. ✅ Transak Key Server-Side (HIGH-2)
4. ✅ Alert() → Toast Notifications (MEDIUM-1)

**Status**: 
- ✅ Committed naar GitHub
- 🔄 Building op Vercel
- ⏳ Deployment in progress

## Deployment URLs

### Production
- **Main**: https://blaze-wallet-blaze-wallets-projects.vercel.app
- **Custom**: (nog niet geconfigureerd)

### Preview
Automatisch voor elke branch/PR:
- Format: `https://blaze-wallet-<hash>-blaze-wallets-projects.vercel.app`

## Next Steps

1. **Monitor deployment**: `vercel ls` om build status te checken
2. **Test CSRF**: Na successful deployment, test CSRF bescherming
3. **Custom domain**: Optioneel custom domain instellen via Vercel dashboard
4. **Environment secrets**: Review alle environment variables voor security

## Troubleshooting

### Vercel not building?
```bash
vercel logs --follow
```

### Supabase niet verbonden?
```bash
supabase projects list
supabase link --project-ref ldehmephukevxumwdbwt
```

### AWS KMS errors?
```bash
aws sts get-caller-identity
aws kms list-keys --region eu-north-1
```

### GitHub push fails?
```bash
gh auth refresh
git remote -v
```

## Security Notes

⚠️ **BELANGRIJK**: 
- `.vercel` directory is toegevoegd aan `.gitignore`
- Alle API keys staan in environment variables
- Nooit credentials committen naar Git
- AWS KMS keys blijven in AWS, alleen encrypted data lokaal

## CLI Versies
- **Vercel CLI**: 48.4.1
- **GitHub CLI**: (geïnstalleerd)
- **Supabase CLI**: (geïnstalleerd)
- **AWS CLI**: (geïnstalleerd)

---

Laatste update: $(date)
Alle CLI's zijn gekoppeld en production-ready! 🚀

