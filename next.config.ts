import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // Common pages visitors look for that don't exist — redirect gracefully
      { source: '/home',    destination: '/',                                        permanent: false },
      { source: '/about',   destination: '/',                                        permanent: false },
      { source: '/contact', destination: 'https://www.linkedin.com/in/jzheng44/', basePath: false, permanent: false },
    ]
  },
};

export default nextConfig;
