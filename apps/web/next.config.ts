import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@safir/ui', '@safir/shared-types', '@safir/validation'],
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['@safir/ui'],
  },
};

export default nextConfig;
