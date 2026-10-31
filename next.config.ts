import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents is intentionally NOT enabled: this app is fully
  // database-driven (every route reads fresh Postgres data), so the Cache
  // Components model would only add Suspense boilerplate without benefit.
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
