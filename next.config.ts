import type { NextConfig } from "next";

const nextConfig: NextConfig = {


  // ✅ ADD THIS BLOCK
  eslint: {
    ignoreDuringBuilds: true,
  },

  images:{
    remotePatterns:[
      {
        protocol:"https",
        hostname:"lh3.googleusercontent.com",
        port:'',
        pathname:"/**"
      },
      {
        protocol:"https",
        hostname:"avatars.githubusercontent.com",
        port:'',
        pathname:"/**"
      },
      {
        protocol:"https",
        hostname:"github.com",
        port:'',
        pathname:"/**"
      }
    ]
  },
  async headers() {
    return [
      {
        // Apply COOP/COEP headers only to playground routes for WebContainers
        source: '/playground/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  reactStrictMode:false
};

export default nextConfig;
