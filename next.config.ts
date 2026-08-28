import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep client-side RSC navigation pinned to the deployment that rendered
  // the document. Next can then detect version skew and perform a safe full
  // navigation instead of repeatedly retrying an incompatible RSC payload.
  deploymentId: process.env.VERCEL_GIT_COMMIT_SHA,
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "nfjbsljlfupdokxfkbrh.supabase.co", pathname: "/storage/v1/object/public/product-media/**" }],
  },
};
export default nextConfig;
