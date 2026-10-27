import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/import", label: "Import Build" },
  { href: "/profiles", label: "Profiles" },
  { href: "/leaderboards", label: "Leaderboards" },
];

export function Navigation() {
  return (
    <header className="site-header">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">T</span>
          <span>TACET<span className="brand-light">DISCORDS</span></span>
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          {links.map(link => (
            <Link key={link.href} href={link.href}>{link.label}</Link>
          ))}
        </nav>
        <span className="version-label">V3 / SOLO</span>
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
