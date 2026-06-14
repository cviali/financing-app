import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for @opennextjs/cloudflare
  output: "standalone",
  // Use Node.js runtime (required by opennextjs/cloudflare)
  experimental: {},
};

export default nextConfig;
