import type { NextConfig } from "next";

/**
 * Production web can be:
 * - Firebase Hosting static export (`output: 'export'`) — no server API routes
 * - Firebase App Hosting / Node host — full Next.js (Paystack + Cloudinary routes)
 *
 * Set STORYNEST_STATIC_EXPORT=1 for static Firebase Hosting only.
 */
const isStatic = process.env.STORYNEST_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStatic
    ? {
        output: "export" as const,
        images: { unoptimized: true },
      }
    : {
        images: {
          remotePatterns: [
            { protocol: "https", hostname: "res.cloudinary.com" },
            { protocol: "https", hostname: "**.cloudinary.com" },
          ],
        },
      }),
};

export default nextConfig;
