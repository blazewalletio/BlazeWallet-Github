/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude native modules from webpack bundling
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // ⚡ Make Breez SDK and React Native optional (prevents build errors)
    // These are loaded dynamically ONLY in native Capacitor context
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@breeztech/react-native-breez-sdk': false,
        'react-native': false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
