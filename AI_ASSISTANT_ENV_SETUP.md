# 🔑 ENVIRONMENT SETUP FOR AI ASSISTANT

## Local Development (.env.local)

Create a `.env.local` file in the project root with:

```bash
# OpenAI API Key for AI Assistant
OPENAI_API_KEY=your_openai_api_key_here
```

## Vercel Production

Add to Vercel Environment Variables:

1. Go to: https://vercel.com/your-project/settings/environment-variables
2. Add variable:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** `your_openai_api_key_here`
   - **Environments:** Production, Preview, Development

3. Redeploy to apply changes

## Supabase Setup

Run the migration:

```bash
# Connect to your Supabase project
psql "your_supabase_connection_string"

# Or via Supabase Dashboard: SQL Editor
# Copy and paste contents of: supabase-migrations/03-ai-assistant-cache.sql
```

## Verify Setup

1. Restart Next.js dev server: `npm run dev`
2. Check console for: `✅ OpenAI API key configured`
3. Test AI assistant in the app

## Cost Monitoring

OpenAI Dashboard: https://platform.openai.com/usage

Expected costs:
- 10,000 users: ~$13.50/month
- 100,000 users: ~$135/month

## Rate Limits

- Per user: 50 queries/day (free)
- Users can add their own API key for unlimited queries
- Rate limit resets daily at midnight UTC

## Security

✅ API key is stored server-side only (Next.js API route)
✅ Never exposed to client
✅ Rate limiting prevents abuse
✅ Supabase RLS protects data

