import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "nfjbsljlfupdokxfkbrh.supabase.co", pathname: "/storage/v1/object/public/product-media/**" }],
  },
};
export default nextConfig;
