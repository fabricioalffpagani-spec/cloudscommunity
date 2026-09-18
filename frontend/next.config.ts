import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.1.111'],
};

export default nextConfig;
