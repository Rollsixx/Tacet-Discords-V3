import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/ui";

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
        <Navigation />
        <main className="container">{children}</main>
        <footer className="site-footer">
          TACET DISCORDS V3 — Independent Wuthering Waves community project
        </footer>
      </body>
    </html>
  );
}
