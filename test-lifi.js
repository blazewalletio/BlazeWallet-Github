const LIFI_API_KEY = '02dff428-23bb-4731-b449-89f63892353a.d0967ed5-1aec-4c87-992a-564b56b7c295';

async function testLiFi() {
  console.log('🔍 Searching for Solana in Li.Fi...\n');
  
  const chainsRes = await fetch('https://li.quest/v1/chains', {
    headers: { 'x-lifi-api-key': LIFI_API_KEY }
  });
  const data = await chainsRes.json();
  const chains = data.chains || [];
  
  console.log(`Total chains: ${chains.length}`);
  console.log('');
  
  // Search for anything Solana-related
  const solanaRelated = chains.filter(c => 
    c.name?.toLowerCase().includes('sol') ||
    c.key?.toLowerCase().includes('sol') ||
    c.coin?.toLowerCase().includes('sol')
  );
  
  if (solanaRelated.length > 0) {
    console.log('✅ Found Solana-related chains:');
    solanaRelated.forEach(c => {
      console.log(`   - ${c.name} (key: ${c.key}, id: ${c.id}, coin: ${c.coin})`);
    });
  } else {
    console.log('❌ NO Solana chains found!');
    console.log('');
    console.log('First 10 chains:');
    chains.slice(0, 10).forEach(c => {
      console.log(`   - ${c.name} (key: ${c.key}, id: ${c.id})`);
    });
  }
  
  // Check chainTypes
  console.log('');
  console.log('Available chainTypes:');
  const types = [...new Set(chains.map(c => c.chainType))];
  console.log(types.join(', '));
  
  // Try getting chains with chainTypes=SOL
  console.log('');
  console.log('Trying chainTypes=SOL...');
  const solRes = await fetch('https://li.quest/v1/chains?chainTypes=SOL', {
    headers: { 'x-lifi-api-key': LIFI_API_KEY }
  });
  const solData = await solRes.json();
  const solChains = solData.chains || [];
  console.log(`Found ${solChains.length} SOL chains`);
  if (solChains.length > 0) {
    solChains.forEach(c => {
      console.log(`   - ${c.name} (key: ${c.key}, id: ${c.id})`);
    });
  }
}

testLiFi().catch(console.error);
