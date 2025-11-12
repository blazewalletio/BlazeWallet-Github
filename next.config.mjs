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
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: https:;
      font-src 'self';
      connect-src 'self' https://ldehmephukevxumwdbwt.supabase.co https://api.openai.com https://api.coingecko.com https://*.etherscan.io https://*.bscscan.com https://*.polygonscan.com https://*.arbiscan.io https://*.optimistic.etherscan.io https://*.basescan.org https://*.snowtrace.io https://*.ftmscan.com https://*.cronoscan.com https://*.lineascan.build https://*.blockchair.com https://global.transak.com https://*.alchemy.com https://*.infura.io https://*.quicknode.pro https://api.dexscreener.com https://price.jup.ag https://api.binance.com wss://ldehmephukevxumwdbwt.supabase.co;
      frame-src https://global.transak.com;
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
            value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
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
