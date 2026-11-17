import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Changelog | Tacet Discords", description: "Updates to Tacet Discords features and community tools." };

export default function ChangelogPage() {
  return <article className="legal-page"><span className="eyebrow">Tacet Discords V3</span><h1>Changelog</h1><p className="legal-intro">A record of updates to the site and its community tools.</p><section><h2>Release notes are being prepared</h2><p>There are no public release notes yet. Follow the community on Discord for announcements while this page is being filled in.</p><p><a href="https://discord.gg/DqxJjKdaWc" target="_blank" rel="noreferrer">Join the Tacet Discord community</a></p></section><p><Link href="/">Return to Home</Link></p></article>;
}
