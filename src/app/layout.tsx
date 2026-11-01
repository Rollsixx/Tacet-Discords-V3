import type { Metadata } from "next";
import "./globals.css";
import { SiteFrame } from "@/components/site-frame";

export const metadata: Metadata = {
  title: "Tacet Discords | Wuthering Waves Builds",
  description: "Wuthering Waves builds, profiles and Solo leaderboards.",
  openGraph: { title: "Tacet Discords | Wuthering Waves Builds", description: "Browse Wuthering Waves player builds, profiles and Solo leaderboards.", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  );
}
