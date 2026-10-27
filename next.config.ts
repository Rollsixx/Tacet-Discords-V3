import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  serverExternalPackages: ["@libsql/client", "tesseract.js", "sharp"],
  outputFileTracingIncludes: { "/api/submissions": ["./node_modules/tesseract.js/**", "./node_modules/tesseract.js-core/**", "./node_modules/@tesseract.js-data/eng/**"] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

