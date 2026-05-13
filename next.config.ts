import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
