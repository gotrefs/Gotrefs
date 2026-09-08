import type { NextConfig } from "next";

// Production app config (Vercel root directory: web). Redeploy trigger.
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
