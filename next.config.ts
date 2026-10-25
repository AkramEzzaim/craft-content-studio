import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: { "/api/articles/**": ["./public/fonts/*.ttf"] },
};
export default nextConfig;
