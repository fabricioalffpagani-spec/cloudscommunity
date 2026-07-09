import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    workerThreads: true,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
