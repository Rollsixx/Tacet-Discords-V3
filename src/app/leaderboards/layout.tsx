import type { Metadata } from "next";
import "./leaderboard-page.css";
export const metadata: Metadata = { title: "Solo Leaderboards | Tacet Discords", description: "Compare standardized Wuthering Waves Resonator build rankings and benchmark damage.", openGraph: { title: "Solo Leaderboards | Tacet Discords", description: "Compare Wuthering Waves Resonator build rankings." } };
export default function LeaderboardsLayout({children}:{children:React.ReactNode}){return children;}
