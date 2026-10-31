import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/import", label: "Import" },
  { href: "/profiles", label: "Profiles" },
  { href: "/leaderboards", label: "Leaderboards" },
];

export function Navigation({ pathname = "/" }: { pathname?: string }) {
  return (
    <header className="site-header">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark"><img src="/tacet-logo.png" alt="" /></span>
          <span>TACET<span className="brand-light">DISCORDS</span></span>
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          {links.map(link => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>{link.label}</Link>
          ))}
        </nav>
        <span className="version-label">V3 / BETA</span>
      </div>
    </header>
  );
}

export function PageHeading({
  eyebrow, title, description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

export function Panel({
  children, className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}

export function LockIcon() {
  return <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></svg>;
}
