"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Navigation } from "./ui";
export function SiteFrame({children}:{children:React.ReactNode}) {
  const pathname=usePathname();
  const admin=pathname==='/BlackShores';
  const wide=pathname==='/leaderboards'||pathname==='/profiles'||pathname==='/import'||pathname==='/hall-of-fame';
  return <div className={`site-frame${admin?' bs-route-active':''}`}><a className="skip-to-content" href="#main-content">Skip to content</a><Navigation pathname={pathname} /><main id="main-content" tabIndex={-1} className={`container${wide?' container-wide':''}`}>{children}</main><footer className="site-footer">TACET DISCORDS V3 — Independent Wuthering Waves community project<span className="art-credit">Game artwork © KURO GAMES</span><Link href="/submission-status">Check submission status</Link></footer></div>;
}
