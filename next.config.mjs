/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nxhekcbt6ebfvgsm.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default nextConfig;
