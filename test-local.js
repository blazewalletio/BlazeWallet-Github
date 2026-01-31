// Script to test localhost and capture console logs
const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting browser test...');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture all console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    console.log('📝 CONSOLE:', text);
    logs.push(text);
  });
  
  // Capture errors
  page.on('pageerror', error => {
    console.error('💥 PAGE ERROR:', error.message);
  });
  
  // Capture request failures
  page.on('requestfailed', request => {
    console.error('❌ REQUEST FAILED:', request.url(), request.failure().errorText);
  });
  
  try {
    console.log('🌐 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('✅ Page loaded successfully!');
    console.log('\n' + '='.repeat(80));
    console.log('📋 ALL CONSOLE LOGS:');
    console.log('='.repeat(80));
    logs.forEach(log => console.log(log));
    console.log('='.repeat(80));
    
    // Keep browser open for manual inspection
    console.log('\n✋ Browser will stay open for 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
  } catch (error) {
    console.error('💥 Error during page load:', error.message);
  } finally {
    await browser.close();
    console.log('🏁 Test complete!');
  }
})();

