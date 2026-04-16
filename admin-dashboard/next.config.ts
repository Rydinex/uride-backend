import type { NextConfig } from "next";

const defaultBackendOrigin = "https://api.rydinex.com";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendBase =
      process.env.BACKEND_BASE_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      defaultBackendOrigin;

    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
