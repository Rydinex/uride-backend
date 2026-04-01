import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendBase = process.env.BACKEND_BASE_URL || "http://10.0.0.70:4000";

    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
