import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Force dynamic rendering (no static generation)
export const dynamic = 'force-dynamic';

// Lazy initialize OpenAI client
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Lazy load AI cache to avoid build-time Supabase initialization
async function getAICache() {
  const { aiCache } = await import('@/lib/ai-cache');
  return aiCache;
}

/**
 * 🤖 AI ASSISTANT API ROUTE
 * 
 * Hybrid Architecture:
 * 1. Check cache (localStorage + Supabase)
 * 2. Call GPT-4o-mini with function calling
 * 3. Cache response
 * 4. Return structured JSON
 * 
 * Rate limit: 50 queries/day per user
 */

const SYSTEM_PROMPT = `You are BlazeWallet AI Assistant, an intelligent crypto wallet assistant.

SUPPORTED CHAINS (18):
- EVM: Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche, Fantom, Cronos, zkSync Era, Linea
- Solana
- Bitcoin
- Bitcoin forks: Litecoin, Dogecoin, Bitcoin Cash

YOUR ROLE:
- Parse user commands into structured actions
- Validate addresses for all supported chains
- Provide clear, helpful responses
- Ask for clarification when information is missing
- Warn about risks (high fees, scams, low balance)

RESPONSE FORMAT:
Always return valid JSON with this structure:
{
  "intent": "send|swap|receive|info|help|clarify",
  "params": {
    "amount": "50",
    "token": "USDC",
    "to": "0x...",
    "from": "ETH",
    "fromToken": "ETH",
    "toToken": "USDC",
    "chain": "ethereum"
  },
  "message": "Clear confirmation message for the user",
  "warnings": ["Any warnings or important notes"],
  "confidence": 0.95,
  "needsClarification": false,
  "clarificationQuestion": "Ask if info is missing",
  "suggestions": ["Helpful suggestions"]
}

EXAMPLES:

User: "Send 50 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0aAcC"
Response: {
  "intent": "send",
  "params": {
    "amount": "50",
    "token": "USDC",
    "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0aAcC"
  },
  "message": "Send 50 USDC to 0x742d...aAcC",
  "confidence": 0.99
}

User: "Swap 1 ETH to USDC"
Response: {
  "intent": "swap",
  "params": {
    "amount": "1",
    "fromToken": "ETH",
    "toToken": "USDC"
  },
  "message": "Swap 1 ETH for USDC",
  "confidence": 0.95
}

User: "What's my balance?"
Response: {
  "intent": "info",
  "message": "Here's your portfolio overview",
  "confidence": 0.99
}

User: "Send USDC"
Response: {
  "intent": "clarify",
  "needsClarification": true,
  "clarificationQuestion": "How much USDC do you want to send?",
  "message": "I need more information to help you",
  "confidence": 0.8
}

IMPORTANT:
- Support ALL variations: "send", "transfer", "pay", "give", "move"
- Handle typos gracefully
- Understand "all", "max", "everything" as 100% of balance
- Validate address formats for each chain
- Be conversational and helpful
- Always include a user-friendly message`;

interface AIRequest {
  query: string;
  context: {
    chain: string;
    balance: string;
    tokens: Array<{
      symbol: string;
      balance: string;
      usdValue: string;
    }>;
    address: string;
  };
  userId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: AIRequest = await req.json();
    const { query, context, userId } = body;

    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log('🤖 [AI API] Processing query:', {
      query: query.substring(0, 50) + '...',
      chain: context.chain,
      userId: userId?.substring(0, 8)
    });

    // Get AI cache instance
    const aiCache = await getAICache();

    // Step 1: Check cache
    const cached = await aiCache.get(query, context);
    if (cached) {
      console.log('✅ [AI API] Cache hit - returning cached response');
      return NextResponse.json({
        ...cached,
        cached: true,
        source: 'cache'
      });
    }

    // Step 2: Check rate limit
    if (userId) {
      const rateLimit = await aiCache.checkRateLimit(userId, 50);
      
      if (!rateLimit.allowed) {
        console.warn('🚫 [AI API] Rate limit exceeded:', userId);
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: 'You have reached your daily limit of 50 AI queries. Please try again tomorrow or use your own API key in settings.',
            remaining: 0,
            total: 50
          },
          { status: 429 }
        );
      }

      console.log('✅ [AI API] Rate limit OK:', rateLimit);
    }

    // Step 3: Call OpenAI GPT-4o-mini
    console.log('📡 [AI API] Calling OpenAI...');
    
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Context:
- Current chain: ${context.chain}
- Native balance: ${context.balance}
- Tokens: ${context.tokens.map(t => `${t.symbol} (${t.balance})`).join(', ')}
- User address: ${context.address}

User command: "${query}"

Parse this command and return structured JSON response.`
        }
      ],
      temperature: 0.1, // Low for consistent parsing
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    const response = JSON.parse(responseText);
    
    console.log('✅ [AI API] OpenAI response:', {
      intent: response.intent,
      confidence: response.confidence
    });

    // Step 4: Cache the response
    if (userId) {
      await aiCache.set(query, response, context, userId);
    }

    // Step 5: Return response
    return NextResponse.json({
      ...response,
      cached: false,
      source: 'openai',
      model: 'gpt-4o-mini'
    });

  } catch (error: any) {
    console.error('❌ [AI API] Error:', error);

    // Handle specific OpenAI errors
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'API key invalid', message: 'OpenAI API key is not configured correctly.' },
        { status: 500 }
      );
    }

    if (error.status === 429) {
      return NextResponse.json(
        { error: 'OpenAI rate limit', message: 'Too many requests to OpenAI. Please try again in a moment.' },
        { status: 429 }
      );
    }

    if (error.status === 500) {
      return NextResponse.json(
        { error: 'OpenAI error', message: 'OpenAI service is temporarily unavailable. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Something went wrong. Please try again.',
        details: error.message
      },
      { status: 500 }
    );
  }
}

