import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Evidencias de reclamos: hasta 10 MB por archivo (+ margen del multipart).
    serverActions: { bodySizeLimit: "11mb" },
    proxyClientMaxBodySize: "11mb",
  },
};

export default nextConfig;
