# Cursor MCP Server Configuration

## 📍 Location
`.cursor/mcp.json` - MCP server configuration for Cursor IDE

## 🔧 Configured MCP Servers

### 1. Onramper (Fiat-to-Crypto)
- **Tools:** 9 tools enabled
- **Use cases:** Crypto purchase quotes, checkout intents, transaction tracking
- **API Key:** From `.env.local` (ONRAMPER_API_KEY)

### 2. Li.Fi (Cross-Chain & DEX Aggregation)
- **Tools:** 9 tools enabled  
- **Use cases:** Cross-chain swaps, bridge aggregation, gas prices, token info
- **API Key:** From `.env.vercel` (LIFI_API_KEY)
- **Custom runner:** `/Users/rickschlimback/mcp-servers/lifi-mcp-server/run.js`

## 🚀 How to Use in Cursor

### Reload MCP Servers
1. Open Command Palette (Cmd+Shift+P)
2. Type "Reload MCP Servers"
3. Or restart Cursor

### View Available Tools
Go to: **Settings → Tools & MCP → Installed MCP Servers**

### Example Queries
**Onramper:**
- "What payment methods are available for buying ETH?"
- "Get me a quote for 100 EUR to ETH"

**Li.Fi:**
- "What chains does Li.Fi support?"
- "Show me bridges from Ethereum to Polygon"
- "What's the current gas price on Arbitrum?"

## ⚙️ Configuration

### API Keys
API keys are loaded from:
- **Onramper:** `.env.local`
- **Li.Fi:** `.env.vercel`

To update:
```bash
# Pull latest env vars from Vercel
vercel env pull .env.vercel

# Regenerate mcp.json with updated keys
npm run update-mcp-config  # (if script exists)
```

### Manual Update
Edit `.cursor/mcp.json` directly and reload MCP servers in Cursor.

## 🔒 Security
- `.cursor/mcp.json` is in `.gitignore` (contains API keys)
- Never commit this file to git
- Keys are pulled from environment files automatically

## 📚 Resources
- **Onramper:** https://docs.onramper.com
- **Li.Fi:** https://docs.li.fi
- **MCP Protocol:** https://modelcontextprotocol.io

---

**Last Updated:** January 9, 2026

