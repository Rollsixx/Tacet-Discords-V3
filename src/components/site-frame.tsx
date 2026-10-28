"use client";
import { usePathname } from "next/navigation";
import { Navigation } from "./ui";
export function SiteFrame({children}:{children:React.ReactNode}) {
  const pathname=usePathname();
  const admin=pathname==='/BlackShores';
  return <div className={`site-frame${admin?' bs-route-active':''}`}><Navigation pathname={pathname} /><main className="container">{children}</main><footer className="site-footer">TACET DISCORDS V3 — Independent Wuthering Waves community project<span className="art-credit">Game artwork © KURO GAMES</span></footer></div>;
}
