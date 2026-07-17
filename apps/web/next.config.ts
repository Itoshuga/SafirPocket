import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', '192.168.1.191'],
  transpilePackages: ['@safir/ui', '@safir/shared-types', '@safir/validation'],
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['@safir/ui'],
  },
};

export default nextConfig;
