/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: '.next',
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Exclude native modules from webpack bundling
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // ⚡ Completely ignore Breez SDK and React Native for web builds
    if (!isServer) {
      config.externals.push({
        '@breeztech/react-native-breez-sdk': 'commonjs @breeztech/react-native-breez-sdk',
        'react-native': 'commonjs react-native',
      });
    }
    
    return config;
  },
  // Trailing slash for better Capacitor compatibility
  trailingSlash: true,
};

export default nextConfig;

