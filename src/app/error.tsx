"use client";
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <section className="route-state"><span className="eyebrow">Something went wrong</span><h1>This page hit a problem.</h1><p className="muted">Your account data was not changed. Try loading this page again.</p><button className="action" onClick={()=>reset()}>Try again</button></section>;}
