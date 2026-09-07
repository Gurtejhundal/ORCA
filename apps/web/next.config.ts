import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@orca/contracts', '@orca/engine', '@orca/geo'],
  turbopack: { root: path.resolve(import.meta.dirname, '../..') },
  devIndicators: false,
};
export default nextConfig;
