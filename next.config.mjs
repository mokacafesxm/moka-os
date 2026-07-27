/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    }
  },
  // pdf-parse (used by lib/importer/extract.js, PR4) pulls in @napi-rs/canvas
  // for optional PDF-to-canvas rendering. That package ships a native .node
  // binary Turbopack/webpack can't bundle — left un-externalized, the build
  // fails with "ReferenceError: DOMMatrix is not defined" while collecting
  // page data for /api/imports/*. Excluding both from bundling and letting
  // Node's native require resolve them at runtime fixes it; we never
  // actually call the canvas-rendering path (only .getText()/.getTable()).
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
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
