"use client";
import { usePathname } from "next/navigation";
import { Navigation } from "./ui";
export function SiteFrame({children}:{children:React.ReactNode}) {
  const admin=usePathname()==='/BlackShores';
  return <div className={`site-frame${admin?' bs-route-active':''}`}><Navigation /><main className="container">{children}</main><footer className="site-footer">TACET DISCORDS V3 — Independent Wuthering Waves community project</footer></div>;
}
