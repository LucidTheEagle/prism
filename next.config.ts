import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  /*
   * transpilePackages:
   * - pdf-parse: existing, required for server-side PDF text extraction
   * - react-pdf: required for the PDF viewer component
   * - pdfjs-dist: react-pdf's underlying engine, must be transpiled
   *   alongside it or Next.js throws module resolution errors at build time
   */
  transpilePackages: ['pdf-parse', 'react-pdf', 'pdfjs-dist'],
};

export default nextConfig;