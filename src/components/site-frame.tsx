"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Navigation } from "./ui";
export function SiteFrame({children}:{children:React.ReactNode}) {
  const pathname=usePathname();
  const admin=pathname==='/BlackShores';
  const wide=pathname==='/leaderboards'||pathname==='/profiles'||pathname==='/import'||pathname==='/hall-of-fame';
  return <div className={`site-frame${admin?' bs-route-active':''}`}><a className="skip-to-content" href="#main-content">Skip to content</a><Navigation pathname={pathname} /><main id="main-content" tabIndex={-1} className={`container${wide?' container-wide':''}`}>{children}</main><footer className="site-footer"><div className="site-footer-inner"><div className="site-footer-about"><strong>TACET DISCORDS V3</strong><p>Independent Wuthering Waves community project.</p><span className="art-credit">Game artwork © KURO GAMES</span></div><nav className="site-footer-links" aria-label="Site"><span className="site-footer-group-label">SITE</span><Link href="/changelog">Changelog</Link><a href="https://discord.gg/DqxJjKdaWc" target="_blank" rel="noreferrer">Discord</a><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></div><div className="site-footer-bottom"><span>Fan-made community tools and rankings.</span><Link href="/submission-status">Check submission status</Link></div></footer></div>;
}
