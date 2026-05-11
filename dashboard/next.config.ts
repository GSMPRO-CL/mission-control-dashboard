import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // turbopack: solo para desarrollo local (next dev --turbo), no aplica en next build
};

export default nextConfig;
