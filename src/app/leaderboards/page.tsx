import { Suspense } from "react";
import { Leaderboard } from "@/components/leaderboard";
export default function LeaderboardsPage() {
 return <Suspense fallback={<div className="placeholder"><h1>Solo Leaderboards</h1><p>Loading rankings…</p></div>}><Leaderboard /></Suspense>;
}
