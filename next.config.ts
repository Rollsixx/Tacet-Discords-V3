import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {NEXT_PUBLIC_APP_RELEASE: process.env.VERCEL_GIT_COMMIT_SHA || "local"},
  cacheComponents: true,
  serverExternalPackages: ["@libsql/client", "tesseract.js", "sharp"],
  // Preserve every Node core-loader branch, including Tesseract 7
  // boolean/OEM compatibility. Exclude browser wrappers from Node bundles.
  outputFileTracingIncludes: {
    "/api/submissions": [
      "./node_modules/tesseract.js/src/**",
      "./node_modules/tesseract.js/package.json",
      "./node_modules/tesseract.js/LICENSE.md",
      "./node_modules/tesseract.js-core/package.json",
      "./node_modules/tesseract.js-core/LICENSE",
      ...["tesseract-core", "tesseract-core-simd", "tesseract-core-relaxedsimd", "tesseract-core-lstm", "tesseract-core-simd-lstm", "tesseract-core-relaxedsimd-lstm"].flatMap(name=>["./node_modules/tesseract.js-core/"+name+".js","./node_modules/tesseract.js-core/"+name+".wasm"]),
      "./node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz",
      "./node_modules/bmp-js/**", "./node_modules/idb-keyval/**",
      "./node_modules/is-url/**", "./node_modules/node-fetch/**",
      "./node_modules/whatwg-url/**", "./node_modules/tr46/**",
      "./node_modules/webidl-conversions/**", "./node_modules/opencollective-postinstall/**",
      "./node_modules/regenerator-runtime/**", "./node_modules/wasm-feature-detect/**",
      "./node_modules/zlibjs/**",
    ],
  },
  outputFileTracingExcludes: {
    "/*": ["./tests/**", "./docs/**", "./src/**/*.test.mjs", "./vendor/wuthering-tools/scoring-source.tar.gz",
      // Vercel Node functions use Linux x64 glibc. The build verifies this
      // contract before pruning incompatible optional native binaries.
      ...(process.env.VERCEL === "1" ? ["./node_modules/@img/*linuxmusl*/**", "./node_modules/@img/sharp-wasm32/**", "./node_modules/@libsql/linux-x64-musl/**"] : []),
    ],
    "/api/submissions": [
      "./node_modules/tesseract.js/dist/**", "./node_modules/tesseract.js/examples/**",
      "./node_modules/tesseract.js-core/*.wasm.js",
      "./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**",
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
