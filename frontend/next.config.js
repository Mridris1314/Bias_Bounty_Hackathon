/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    return [
      // Proxy /api/backend/* → backend, keeping /api/v1 pathing on the FE
      { source: "/api/backend/:path*", destination: `${backend}/:path*` },
    ];
  },
};

module.exports = nextConfig;
