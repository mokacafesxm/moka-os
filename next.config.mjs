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
  // Public custom domain lands customers on the ordering app, not the
  // internal OrderPad/KDS/staff tool at "/" — scoped to the host so
  // moka-os.vercel.app (where the internal tool stays reachable) is
  // untouched. 308 is Next.js's built-in "permanent" redirect status
  // (method-preserving; equivalent to 301 for SEO/browser purposes).
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'host', value: 'mokacafe.co' }],
        destination: '/commander',
        permanent: true,
      },
      {
        source: '/',
        has: [{ type: 'host', value: 'www.mokacafe.co' }],
        destination: '/commander',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
