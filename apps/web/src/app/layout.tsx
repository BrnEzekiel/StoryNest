import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: {
    default: "StoryNest — The home for imagination",
    template: "%s · StoryNest",
  },
  description:
    "Premium long-form reading and writing. Stories, streaks, and a nest for imagination.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-8 text-center text-xs tracking-widest text-muted-foreground">
          STORYNEST · THE HOME FOR IMAGINATION
        </footer>
      </body>
    </html>
  );
}
