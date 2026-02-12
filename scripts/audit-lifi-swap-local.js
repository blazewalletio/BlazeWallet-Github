/* eslint-disable no-console */
const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000';

function buildUrl(path, params) {
  const url = new URL(path, BASE_URL);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { response, data };
}

async function waitForServer(maxAttempts = 40, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { response } = await requestJson(buildUrl('/api/lifi/tokens', { chainIds: 1 }));
      if (response.ok || response.status === 400) {
        return true;
      }
    } catch {
      // keep retrying
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

async function run() {
  const ready = await waitForServer();
  if (!ready) {
    console.error('❌ Local server is not reachable:', BASE_URL);
    process.exit(1);
  }

  console.log(`✅ Local server reachable: ${BASE_URL}`);

  const evmAddress = '0xBf18189f7cAb0E57e98e996685A8D3D0BB88491B';
  const solAddress = 'HWF77smbXDxoT7hmnttRteRAjcmoco9ZkVXJwibSikoi';
  const nativeUsdcEth = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  const scenarios = [
    {
      id: 'quote_evm_same_chain_success_candidate',
      method: 'GET',
      path: '/api/lifi/quote',
      params: {
        fromChain: 1,
        toChain: 1,
        fromToken: 'native',
        toToken: nativeUsdcEth,
        fromAmount: '10000000000000000', // 0.01 ETH
        fromAddress: evmAddress,
        toAddress: evmAddress,
        slippage: 0.01,
        order: 'RECOMMENDED',
      },
      expectedStatuses: [200, 400, 404],
      expectQuoteWhen200: true,
    },
    {
      id: 'quote_evm_to_solana_success_candidate',
      method: 'GET',
      path: '/api/lifi/quote',
      params: {
        fromChain: 1,
        toChain: '1151111081099710',
        fromToken: 'native',
        toToken: 'native',
        fromAmount: '10000000000000000', // 0.01 ETH
        fromAddress: evmAddress,
        toAddress: solAddress,
        slippage: 0.01,
        order: 'RECOMMENDED',
      },
      expectedStatuses: [200, 400, 404],
      expectQuoteWhen200: true,
    },
    {
      id: 'quote_unsupported_bitcoin_source_is_blocked',
      method: 'GET',
      path: '/api/lifi/quote',
      params: {
        fromChain: 'bitcoin',
        toChain: '1151111081099710',
        fromToken: 'native',
        toToken: 'native',
        fromAmount: '151100',
        fromAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        toAddress: solAddress,
        slippage: 0.01,
        order: 'RECOMMENDED',
      },
      expectedStatuses: [400],
      expectErrorContains: 'Unsupported',
    },
    {
      id: 'tokens_requires_supported_chain_ids',
      method: 'GET',
      path: '/api/lifi/tokens',
      params: { chainIds: '1,137,8453,42161,1151111081099710,0' },
      expectedStatuses: [200],
    },
    {
      id: 'tokens_rejects_missing_chain_ids',
      method: 'GET',
      path: '/api/lifi/tokens',
      params: {},
      expectedStatuses: [400],
    },
    {
      id: 'status_rejects_missing_chain_info',
      method: 'GET',
      path: '/api/lifi/status',
      params: {
        txHash: '0xabc',
        bridge: 'relay',
      },
      expectedStatuses: [400],
    },
    {
      id: 'status_rejects_unsupported_chain_pair',
      method: 'GET',
      path: '/api/lifi/status',
      params: {
        txHash: '0xabc',
        bridge: 'relay',
        fromChain: 'bitcoin',
        toChain: '1151111081099710',
      },
      expectedStatuses: [400],
      expectErrorContains: 'Unsupported',
    },
  ];

  let failures = 0;

  for (const scenario of scenarios) {
    const url = buildUrl(scenario.path, scenario.params);
    const { response, data } = await requestJson(url, { method: scenario.method });
    const statusOk = scenario.expectedStatuses.includes(response.status);

    let validationOk = true;
    if (statusOk && response.status === 200 && scenario.expectQuoteWhen200) {
      validationOk = Boolean(data?.success && data?.quote);
    }

    if (statusOk && scenario.expectErrorContains) {
      const textBlob = `${data?.error || ''} ${data?.details || ''} ${data?.hint || ''}`;
      validationOk = textBlob.toLowerCase().includes(scenario.expectErrorContains.toLowerCase());
    }

    const passed = statusOk && validationOk;
    if (!passed) {
      failures += 1;
    }

    console.log(
      `${passed ? '✅' : '❌'} ${scenario.id} | status=${response.status} | expected=${scenario.expectedStatuses.join(',')}`
    );
    if (!passed) {
      console.log('   url:', url);
      console.log('   body:', JSON.stringify(data));
    }
  }

  if (failures > 0) {
    console.error(`\n❌ Swap audit finished with ${failures} failure(s).`);
    process.exit(1);
  }

  console.log('\n✅ Swap audit finished successfully.');
}

run().catch((error) => {
  console.error('❌ Unexpected audit error:', error);
  process.exit(1);
});


