import type { NextConfig } from 'next';

const allowedDevOrigins = new Set(['localhost', '127.0.0.1']);
try {
  allowedDevOrigins.add(
    new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').hostname,
  );
} catch {
  // Environment validation remains the responsibility of the application boundary.
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [...allowedDevOrigins],
  transpilePackages: ['@safir/ui', '@safir/shared-types', '@safir/validation'],
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    optimizePackageImports: ['@safir/ui'],
  },
};

export default nextConfig;
