const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting detailed browser test...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture ALL console messages with types
  const logs = [];
  page.on('console', async msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();
    
    // Try to get args
    const args = [];
    for (const arg of msg.args()) {
      try {
        args.push(await arg.jsonValue());
      } catch (e) {
        args.push(text);
      }
    }
    
    const logEntry = {
      type,
      text,
      args,
      location
    };
    
    logs.push(logEntry);
    
    // Print with colors
    const emoji = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'log' ? '📝' : '💬';
    console.log(`${emoji} [${type.toUpperCase()}]:`, text);
    
    // Special handling for Supabase logs
    if (text.includes('SUPABASE') || text.includes('supabase') || text.includes('env')) {
      console.log('   🔍 IMPORTANT:', JSON.stringify(args, null, 2));
    }
  });
  
  // Capture errors
  page.on('pageerror', error => {
    console.error('💥 PAGE ERROR:', error.message);
    console.error('   Stack:', error.stack);
  });
  
  try {
    console.log('🌐 Navigating to http://localhost:3000...\n');
    
    await page.goto('http://localhost:3000', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    
    // Wait a bit for all console logs to appear
    console.log('\n⏳ Waiting 5 seconds for console logs...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(80));
    console.log('Total logs captured:', logs.length);
    console.log('Errors:', logs.filter(l => l.type === 'error').length);
    console.log('Warnings:', logs.filter(l => l.type === 'warning').length);
    console.log('Regular logs:', logs.filter(l => l.type === 'log').length);
    
    // Check for Supabase-related logs
    const supabaseLogs = logs.filter(l => 
      l.text.toLowerCase().includes('supabase') || 
      l.text.toLowerCase().includes('env') ||
      l.text.includes('🚀') ||
      l.text.includes('📍')
    );
    
    if (supabaseLogs.length > 0) {
      console.log('\n🔍 SUPABASE-RELATED LOGS:');
      supabaseLogs.forEach(log => {
        console.log(`   ${log.text}`);
      });
    } else {
      console.log('\n⚠️  NO SUPABASE INITIALIZATION LOGS FOUND!');
      console.log('   This might mean:');
      console.log('   1. The module is being bundled/minified');
      console.log('   2. Console.group is being filtered');
      console.log('   3. The page hasn\'t fully loaded');
    }
    
    // Look for specific errors
    const criticalErrors = logs.filter(l => 
      l.text.includes('supabaseKey is required') ||
      l.text.includes('FATAL') ||
      l.text.includes('💥')
    );
    
    if (criticalErrors.length > 0) {
      console.log('\n🚨 CRITICAL ERRORS FOUND:');
      criticalErrors.forEach(log => {
        console.log(`   ${log.text}`);
      });
    }
    
    console.log('='.repeat(80));
    
    // Save full log to file
    const fs = require('fs');
    fs.writeFileSync('browser-console-logs.json', JSON.stringify(logs, null, 2));
    console.log('\n💾 Full logs saved to: browser-console-logs.json');
    
  } catch (error) {
    console.error('\n💥 Error during test:', error.message);
  } finally {
    await browser.close();
    console.log('\n🏁 Test complete!\n');
  }
})();

