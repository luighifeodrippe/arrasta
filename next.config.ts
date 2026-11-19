import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // Uma versão em uso e outra em conferência podem conviver na mesma pasta, cada uma com a sua compilação.
  distDir: process.env.ARRASTA_DIST ?? ".next",
  devIndicators: false,
  serverExternalPackages: ["@openai/codex"],
  images: { unoptimized: true },
};

export default nextConfig;
