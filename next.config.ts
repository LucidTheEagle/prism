import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  // Tell Next.js to transpile pdf-parse properly
  transpilePackages: ['pdf-parse'],
};

export default nextConfig;