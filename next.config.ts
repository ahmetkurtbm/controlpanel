import { randomBytes } from "node:crypto";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fallback session key when AUTH_SECRET is not set: unique to each build.
  env: { CONTROLPANEL_BUILD_SECRET: randomBytes(32).toString("hex") },
};

export default nextConfig;
