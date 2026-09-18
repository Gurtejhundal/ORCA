import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@orca/contracts', '@orca/engine', '@orca/geo'],
  turbopack: { root: path.resolve(import.meta.dirname, '../..') },
  outputFileTracingIncludes: { '/api/*': ['../../data/demo/**/*'] },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'eoimages.gsfc.nasa.gov' },
      { protocol: 'https', hostname: 'marinenavigation.noaa.gov' },
    ],
  },
  devIndicators: false,
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${process.env.BACKEND_URL ?? 'http://127.0.0.1:8000'}/api/v1/:path*` }];
  },
};
export default nextConfig;
