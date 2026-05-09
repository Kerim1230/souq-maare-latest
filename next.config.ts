import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  allowedDevOrigins: ["*"],

  // Image optimization for performance
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 3600,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Optimize package imports for smaller bundle
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-hot-toast', 'recharts', 'framer-motion', 'date-fns', '@radix-ui/react-icons'],
  },

  // Compress responses
  compress: true,

  // Reduce production build size
  productionBrowserSourceMaps: false,

  // Cache-busting headers — prevent Vercel CDN from serving stale HTML/JS
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
      {
        // HTML pages should never be cached by CDN — always fetch fresh
        source: '/:path((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|app-icon.png|logo.svg).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Static JS/CSS chunks — immutable, cache aggressively
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
