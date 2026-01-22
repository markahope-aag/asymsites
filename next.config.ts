import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure external packages for server components (Next.js 16 syntax)
  serverExternalPackages: ['ssh2'],
  
  // Empty turbopack config to silence the warning and allow webpack config
  turbopack: {},
  
  // Webpack configuration for SSH2 compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle SSH2 native dependencies
      config.externals = config.externals || [];
      config.externals.push({
        'ssh2': 'commonjs ssh2',
      });
    }
    
    return config;
  },
};

export default nextConfig;
