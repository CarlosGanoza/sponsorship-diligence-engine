import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@tesseract.js-data/eng", "pdf-parse", "tesseract.js", "tesseract.js-core"],
  typedRoutes: true,
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
