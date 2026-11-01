import Link from "next/link";
export default function NotFound(){return <section className="route-state"><span className="eyebrow">404 · Not found</span><h1>We couldn’t find that page.</h1><p className="muted">The link may be old or the address may be incomplete.</p><Link className="action" href="/">Back to Home</Link></section>;}
