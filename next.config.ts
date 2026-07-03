import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // Increase body size limit for document uploads (50MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
