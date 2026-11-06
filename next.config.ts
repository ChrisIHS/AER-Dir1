import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The export routes and the new-site form read the AER templates from reference/ at runtime.
  outputFileTracingIncludes: {
    "/sites": ["./reference/**/*"],
    "/sites/[siteId]/export": ["./reference/**/*"],
    "/sites/[siteId]/export/[file]": ["./reference/**/*"],
  },
  experimental: {
    // Rate sheets and plans are uploaded through server actions (Phase 1).
    // Vercel still caps request bodies (~4.5 MB): move uploads to signed URLs before deploying.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
