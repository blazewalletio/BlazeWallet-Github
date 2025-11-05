/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude Supabase functions directory from TypeScript checking
  typescript: {
    ignoreBuildErrors: false,
  },
  // Exclude supabase functions from build
  excludeDefaultMomentLocales: true,
  
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
