import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The export routes and the new-site form read the AER templates from reference/ at runtime.
  outputFileTracingIncludes: {
    "/sites": ["./reference/**/*"],
    "/sites/[siteId]/export": ["./reference/**/*"],
    "/sites/[siteId]/export/[file]": ["./reference/**/*"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  experimental: {
    // Rate sheets and plans are uploaded through server actions (Phase 1).
    // Vercel still caps request bodies (~4.5 MB): move uploads to signed URLs before deploying.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
