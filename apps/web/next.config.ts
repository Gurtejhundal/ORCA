import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@orca/contracts', '@orca/engine', '@orca/geo'],
  turbopack: { root: path.resolve(import.meta.dirname, '../..') },
  devIndicators: false,
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${process.env.BACKEND_URL ?? 'http://127.0.0.1:8000'}/api/v1/:path*` }];
  },
};
export default nextConfig;
