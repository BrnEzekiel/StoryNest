import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://storynest.app";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://storynest-qzwm.onrender.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/explore`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  ];
  try {
    const res = await fetch(`${API_URL}/v1/stories?limit=50`, { next: { revalidate: 3600 } });
    if (!res.ok) return staticRoutes;
    const json = await res.json();
    const stories = Array.isArray(json.data) ? json.data : [];
    return [
      ...staticRoutes,
      ...stories.map((s: any) => ({
        url: `${SITE_URL}/stories/${s.id}`,
        lastModified: s.publishedAt ? new Date(s.publishedAt) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
