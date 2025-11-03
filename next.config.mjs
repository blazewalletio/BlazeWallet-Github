/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude native modules from webpack bundling
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // ⚡ Exclude Breez SDK (React Native) from web build
    // Breez SDK is only used in native Capacitor apps via bridge
    config.externals.push('@breeztech/react-native-breez-sdk', 'react-native');
    
    // Handle React Native modules that might be imported
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native': false,
      '@breeztech/react-native-breez-sdk': false,
    };
    
    return config;
  },
};

export default nextConfig;
