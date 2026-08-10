import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    workerThreads: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  // Allow local addresses during development so dev HMR/ws connections
  // originating from 127.0.0.1 or localhost are accepted.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;
