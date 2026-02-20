import type { NextConfig } from 'next'

/**
 * Bundle analyzer — enabled via ANALYZE=true environment variable.
 * Run: ANALYZE=true npm run build
 * This generates two HTML reports (client + server bundle breakdown).
 *
 * Install if not present: npm install --save-dev @next/bundle-analyzer
 */
const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@next/bundle-analyzer')({ enabled: true })
    : (config: NextConfig) => config

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},

  /*
   * transpilePackages:
   * - pdf-parse:   server-side PDF text extraction
   * - react-pdf:   client PDF viewer component
   * - pdfjs-dist:  react-pdf's underlying engine — must be transpiled
   *                alongside it or Next.js throws module resolution errors
   */
  transpilePackages: ['pdf-parse', 'react-pdf', 'pdfjs-dist'],

  /*
   * Experimental optimizations for Next.js 16:
   * - optimizePackageImports: tree-shakes large icon/component libraries
   *   so only the icons actually used are included in the client bundle.
   */
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
}

export default withBundleAnalyzer(nextConfig)