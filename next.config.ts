import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@openai/codex"],
  images: { unoptimized: true },
};

export default nextConfig;
