import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance Optimizations
  compress: true,
  poweredByHeader: false,
  
  // React Optimizations
  reactStrictMode: true,
  
  // Image Optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Turbopack Configuration (Next.js 16+)
  turbopack: {},
  
  // Experimental Features for Performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react'],
  },
  
  // Production Optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
};

export default nextConfig;
