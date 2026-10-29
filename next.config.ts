import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {NEXT_PUBLIC_APP_RELEASE: process.env.VERCEL_GIT_COMMIT_SHA || "local"},
  cacheComponents: true,
  serverExternalPackages: ["@libsql/client", "tesseract.js", "sharp"],
  // OCR runs in a worker thread, whose transitive imports are invisible to tracing.
  outputFileTracingIncludes: {
    "/api/submissions": [
      "./node_modules/tesseract.js/**",
      "./node_modules/bmp-js/**",
      "./node_modules/idb-keyval/**",
      "./node_modules/is-url/**",
      "./node_modules/node-fetch/**",
      "./node_modules/whatwg-url/**",
      "./node_modules/tr46/**",
      "./node_modules/webidl-conversions/**",
      "./node_modules/opencollective-postinstall/**",
      "./node_modules/regenerator-runtime/**",
      "./node_modules/tesseract.js-core/**",
      "./node_modules/wasm-feature-detect/**",
      "./node_modules/zlibjs/**",
      "./node_modules/@tesseract.js-data/eng/**",
    ],
  },
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
