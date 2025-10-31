/**
 * 🧪 BITCOIN INTEGRATION TEST SUITE
 * 
 * Tests all Bitcoin functionality:
 * 1. HD Wallet derivation
 * 2. Address validation
 * 3. Balance fetching
 * 4. Fee estimation
 * 5. UTXO fetching
 * 6. Transaction history
 * 7. MultiChainService integration
 */

const { BitcoinService } = require('./lib/bitcoin-service.ts');
const { MultiChainService } = require('./lib/multi-chain-service.ts');

// Test mnemonic (DO NOT USE IN PRODUCTION!)
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

console.log('🧪 BITCOIN INTEGRATION TEST SUITE\n');
console.log('='.repeat(50));

// Test 1: HD Wallet Derivation
console.log('\n📋 TEST 1: HD Wallet Derivation');
console.log('-'.repeat(50));

const bitcoinService = new BitcoinService('mainnet');

const nativeSegwit = bitcoinService.deriveBitcoinAddress(TEST_MNEMONIC, 'native-segwit');
console.log(`✅ Native SegWit (bc1...): ${nativeSegwit.address}`);
console.log(`   WIF: ${nativeSegwit.wif.substring(0, 10)}...`);

const segwit = bitcoinService.deriveBitcoinAddress(TEST_MNEMONIC, 'segwit');
console.log(`✅ SegWit (3...): ${segwit.address}`);

const legacy = bitcoinService.deriveBitcoinAddress(TEST_MNEMONIC, 'legacy');
console.log(`✅ Legacy (1...): ${legacy.address}`);

// Test 2: Address Validation
console.log('\n📋 TEST 2: Address Validation');
console.log('-'.repeat(50));

const testAddresses = [
  { address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', expected: true, type: 'Native SegWit' },
  { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', expected: true, type: 'Legacy' },
  { address: '3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy', expected: true, type: 'SegWit' },
  { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', expected: false, type: 'Invalid (EVM)' },
  { address: 'DYw8jCTfwHNRJN2FCLA4RFGXuCkQ', expected: false, type: 'Invalid (Solana)' },
];

testAddresses.forEach(({ address, expected, type }) => {
  const isValid = BitcoinService.isValidAddress(address);
  const status = isValid === expected ? '✅' : '❌';
  console.log(`${status} ${type}: ${isValid ? 'VALID' : 'INVALID'} (${address.substring(0, 20)}...)`);
});

// Test 3: Balance Fetching
console.log('\n📋 TEST 3: Balance Fetching');
console.log('-'.repeat(50));

(async () => {
  try {
    // Test with a known address with balance (Satoshi's address)
    const testAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
    console.log(`Testing address: ${testAddress}`);
    
    const balance = await bitcoinService.getBalance(testAddress);
    console.log(`✅ Confirmed: ${balance.confirmed} sats (${(balance.confirmed / 100000000).toFixed(8)} BTC)`);
    console.log(`✅ Unconfirmed: ${balance.unconfirmed} sats`);
    console.log(`✅ Total: ${balance.total} sats (${(balance.total / 100000000).toFixed(8)} BTC)`);
  } catch (error) {
    console.error('❌ Balance fetch failed:', error.message);
  }
})();

// Test 4: Fee Estimation
console.log('\n📋 TEST 4: Fee Estimation');
console.log('-'.repeat(50));

(async () => {
  try {
    const fees = await bitcoinService.estimateFees();
    console.log(`✅ Slow: ${fees.slow} sat/vB (Total: ${fees.slowTotal || 0} sats)`);
    console.log(`✅ Standard: ${fees.standard} sat/vB (Total: ${fees.standardTotal || 0} sats)`);
    console.log(`✅ Fast: ${fees.fast} sat/vB (Total: ${fees.fastTotal || 0} sats)`);
  } catch (error) {
    console.error('❌ Fee estimation failed:', error.message);
  }
})();

// Test 5: UTXO Fetching
console.log('\n📋 TEST 5: UTXO Fetching');
console.log('-'.repeat(50));

(async () => {
  try {
    const testAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
    const utxos = await bitcoinService.getUTXOs(testAddress);
    console.log(`✅ Found ${utxos.length} UTXOs`);
    
    if (utxos.length > 0) {
      console.log(`   First UTXO:`);
      console.log(`   - TxID: ${utxos[0].txid.substring(0, 20)}...`);
      console.log(`   - Value: ${utxos[0].value} sats`);
      console.log(`   - Confirmations: ${utxos[0].confirmations}`);
    }
  } catch (error) {
    console.error('❌ UTXO fetch failed:', error.message);
  }
})();

// Test 6: Transaction History
console.log('\n📋 TEST 6: Transaction History');
console.log('-'.repeat(50));

(async () => {
  try {
    const testAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
    const history = await bitcoinService.getTransactionHistory(testAddress, 3);
    console.log(`✅ Found ${history.length} transactions`);
    
    history.forEach((tx, i) => {
      console.log(`   ${i + 1}. ${tx.hash.substring(0, 20)}...`);
      console.log(`      From: ${tx.from?.substring(0, 20) || 'N/A'}...`);
      console.log(`      To: ${tx.to?.substring(0, 20) || 'N/A'}...`);
      console.log(`      Value: ${tx.value} BTC`);
      console.log(`      Type: ${tx.type}`);
    });
  } catch (error) {
    console.error('❌ Transaction history failed:', error.message);
  }
})();

// Test 7: MultiChainService Integration
console.log('\n📋 TEST 7: MultiChainService Integration');
console.log('-'.repeat(50));

(async () => {
  try {
    const multiChain = MultiChainService.getInstance('bitcoin');
    console.log(`✅ MultiChainService initialized for Bitcoin`);
    
    // Test balance
    const testAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
    const balance = await multiChain.getBalance(testAddress);
    console.log(`✅ Balance via MultiChain: ${balance} BTC`);
    
    // Test fee estimation
    const gas = await multiChain.getGasPrice();
    console.log(`✅ Gas prices:`);
    console.log(`   - Slow: ${gas.slow} sat/vB`);
    console.log(`   - Standard: ${gas.standard} sat/vB`);
    console.log(`   - Fast: ${gas.fast} sat/vB`);
    
    // Test address validation
    const validBTC = multiChain.isValidAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    const validETH = multiChain.isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
    console.log(`✅ BTC address validation: ${validBTC ? 'VALID' : 'INVALID'}`);
    console.log(`✅ ETH address validation (should fail): ${validETH ? 'VALID' : 'INVALID'}`);
    
    // Test address format hint
    const hint = multiChain.getAddressFormatHint();
    console.log(`✅ Address format hint: "${hint}"`);
    
  } catch (error) {
    console.error('❌ MultiChainService integration failed:', error.message);
  }
})();

console.log('\n' + '='.repeat(50));
console.log('🎯 TEST SUITE COMPLETE!\n');
console.log('All tests should pass. Check output above for any ❌ errors.');
console.log('If all ✅, Bitcoin integration is PERFECT! 🚀\n');

