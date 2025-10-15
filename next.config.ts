import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'soluna-pmc-pdfs.s3.us-east-2.amazonaws.com',
      },
    ],
  },
  // Allow native package to be left as external in server build (Next.js 15)
  serverExternalPackages: ['@resvg/resvg-js'],
  // Ensure file tracing uses this workspace as the root (avoid picking parent lockfile)
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
