import createBundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  serverExternalPackages: ['pdf-parse', 'tesseract.js', 'pdf2pic'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default withBundleAnalyzer(nextConfig);
