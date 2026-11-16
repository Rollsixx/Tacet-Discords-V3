import type { Metadata } from "next";
import "./profiles-page.css";
export const metadata: Metadata = { title: "Player Profiles | Tacet Discords", description: "Browse verified Wuthering Waves players and inspect their approved Resonator Echo builds.", openGraph: { title: "Player Profiles | Tacet Discords", description: "Browse player profiles and approved Wuthering Waves builds." } };
export default function ProfilesLayout({children}:{children:React.ReactNode}){return children;}
