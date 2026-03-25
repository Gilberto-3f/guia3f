import type { NextConfig } from "next";

let supabaseHostname = "localhost";
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) supabaseHostname = new URL(url).hostname;
} catch {
  /* ignore */
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  allowedDevOrigins: ['192.168.0.103', 'localhost', '127.0.0.1'],
};

export default nextConfig;