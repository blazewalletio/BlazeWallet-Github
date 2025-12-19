/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude Supabase functions directory from TypeScript checking
  typescript: {
    ignoreBuildErrors: false,
  },
  // Exclude supabase functions from build
  excludeDefaultMomentLocales: true,
  
  // 🔒 Security Headers
  async headers() {
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://static.moonpay.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: https:;
      font-src 'self';
      connect-src 'self' https://ldehmephukevxumwdbwt.supabase.co https://api.openai.com https://api.coingecko.com https://api.exchangerate-api.com https://*.etherscan.io https://*.bscscan.com https://*.polygonscan.com https://*.arbiscan.io https://*.optimistic.etherscan.io https://*.basescan.org https://*.snowtrace.io https://*.ftmscan.com https://*.cronoscan.com https://*.lineascan.build https://*.blockchair.com https://*.blockchain.com https://*.blockstream.info https://blockstream.info https://mempool.space https://api.blockcypher.com https://blockchain.info https://global.transak.com https://api.onramper.com https://widget.onramper.com https://*.alchemy.com https://*.infura.io https://*.quicknode.pro https://api.dexscreener.com https://cdn.dexscreener.com https://ipfs.io https://price.jup.ag https://api.binance.com https://bsc-dataseed.binance.org https://bsc-dataseed1.binance.org https://bsc-dataseed2.binance.org https://bsc-dataseed3.binance.org https://bsc-dataseed4.binance.org https://data-seed-prebsc-1-s1.binance.org:8545 https://rpc.ankr.com https://mainnet.optimism.io https://api.avax.network https://polygon-rpc.com https://evm.cronos.org https://rpc.linea.build https://arb1.arbitrum.io https://mainnet.base.org https://*.publicnode.com https://rpcapi.fantom.network https://mainnet.era.zksync.io https://*.explorer.zksync.io https://*.era.zksync.io https://api.mainnet-beta.solana.com https://solana-api.projectserum.com https://rpc.ankr.com/solana https://api.moonpay.com https://api-sandbox.moonpay.com wss://ldehmephukevxumwdbwt.supabase.co wss://*.alchemy.com wss://solana-mainnet.g.alchemy.com;
      frame-src https://global.transak.com https://widget.onramper.com https://buy.onramper.com https://docs.onramper.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self "https://widget.onramper.com"), microphone=(self "https://widget.onramper.com"), geolocation=(self "https://widget.onramper.com"), payment=(self "https://widget.onramper.com")',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  
  webpack: (config, { isServer }) => {
    // Exclude native modules from webpack bundling
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // ⚡ Completely ignore Breez SDK and React Native
    // Mark as externals so webpack doesn't try to bundle them
    config.externals.push({
      '@breeztech/react-native-breez-sdk': 'commonjs @breeztech/react-native-breez-sdk',
      'react-native': 'commonjs react-native',
    });
    
    // Ignore supabase functions directory
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/supabase/functions/**',
      ],
    };
    
    return config;
  },
};

export default nextConfig;
