import type { Metadata } from "next";
import "./globals.css";
import { SiteFrame } from "@/components/site-frame";

export const metadata: Metadata = {
  title: "Tacet Discords | Wuthering Waves Builds",
  description: "Wuthering Waves builds, profiles and Solo leaderboards.",
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
