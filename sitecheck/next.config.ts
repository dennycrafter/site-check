import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Customer links are created by Base's signup system; the old self-serve start page is gone.
    return [{ source: "/start", destination: "/", permanent: false }];
  },
};

export default nextConfig;
