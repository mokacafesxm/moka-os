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
  // Host-scoped routing for the public domain (only /commander + its
  // dependencies reachable on mokacafe.co) now lives in middleware.js —
  // middleware runs before next.config.js redirects are ever evaluated, so
  // keeping a redirect here too would just be dead, easy-to-drift duplicate
  // config. See middleware.js for the actual logic.
};

export default nextConfig;
