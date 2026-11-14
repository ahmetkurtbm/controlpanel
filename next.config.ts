import { randomBytes } from "node:crypto";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fallback session key when AUTH_SECRET is not set: unique to each build.
  env: { CONTROLPANEL_BUILD_SECRET: randomBytes(32).toString("hex") },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
