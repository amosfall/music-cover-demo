import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.blob.vercel-storage.com", pathname: "/**" },
      { protocol: "https", hostname: "*.music.126.net", pathname: "/**" },
      { protocol: "http", hostname: "*.music.126.net", pathname: "/**" },
    ],
  },
};

export default nextConfig;
