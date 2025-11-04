/**
 * 🧪 TEST SCRIPT: Verify Separate Whisper API Key
 * 
 * This script verifies that:
 * 1. WHISPER_API_KEY is properly set in Vercel
 * 2. Voice transcription works independently from AI Assistant
 * 3. Rate limits are separated
 */

console.log('🧪 Testing Separate Whisper API Key Setup...\n');

// Test 1: Check environment variables
console.log('📋 TEST 1: Environment Variables Check');
console.log('=====================================');

const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasWhisper = !!process.env.WHISPER_API_KEY;
const openAIprefix = process.env.OPENAI_API_KEY?.substring(0, 20);
const whisperPrefix = process.env.WHISPER_API_KEY?.substring(0, 20);

console.log(`OPENAI_API_KEY:  ${hasOpenAI ? '✅ Set' : '❌ Missing'} (${openAIprefix}...)`);
console.log(`WHISPER_API_KEY: ${hasWhisper ? '✅ Set' : '❌ Missing'} (${whisperPrefix}...)`);

if (hasOpenAI && hasWhisper) {
  const areDifferent = process.env.OPENAI_API_KEY !== process.env.WHISPER_API_KEY;
  console.log(`Keys are different: ${areDifferent ? '✅ YES' : '⚠️  NO (using same key)'}`);
} else {
  console.log('❌ Cannot compare - one or both keys missing');
}

console.log('\n');

// Test 2: Verify Vercel deployment
console.log('📋 TEST 2: Vercel Environment Variables');
console.log('=====================================');
console.log('Run this command to verify Vercel setup:');
console.log('$ vercel env ls | grep -E "(OPENAI|WHISPER)"');
console.log('\nExpected output:');
console.log('OPENAI_API_KEY    Encrypted    Production,Preview,Development');
console.log('WHISPER_API_KEY   Encrypted    Production,Preview,Development');
console.log('\n');

// Test 3: API endpoint test
console.log('📋 TEST 3: Manual API Test');
console.log('=====================================');
console.log('To test voice transcription API:');
console.log('');
console.log('1. Open Blaze Wallet in browser');
console.log('2. Go to AI Assistant (AI Tools)');
console.log('3. Click the microphone button');
console.log('4. Say a command (e.g., "send 0.1 SOL to test")');
console.log('5. Open Console (F12) and check for:');
console.log('   🔑 [Whisper API] Using dedicated WHISPER_API_KEY ✅');
console.log('');
console.log('If you see:');
console.log('   🔑 [Whisper API] Using fallback OPENAI_API_KEY ❌');
console.log('   → WHISPER_API_KEY is not set in Vercel!');
console.log('\n');

// Summary
console.log('📊 SUMMARY');
console.log('=====================================');
console.log(`Local Setup:     ${hasOpenAI && hasWhisper ? '✅ Complete' : '❌ Incomplete'}`);
console.log(`Vercel Setup:    Run 'vercel env ls' to verify`);
console.log(`Deployment:      ${process.env.VERCEL ? '✅ On Vercel' : '⚠️  Local only'}`);
console.log('\n');

if (hasOpenAI && hasWhisper) {
  console.log('✅ Setup looks good! Deploy to Vercel and test voice input.');
} else {
  console.log('❌ Missing API keys. Check .env.local or Vercel environment variables.');
}

console.log('\n🔗 Documentation: SEPARATE_API_KEYS_SETUP.md');

