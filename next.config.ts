import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  serverExternalPackages: ["@openai/codex"],
  images: { unoptimized: true },
};

export default nextConfig;
