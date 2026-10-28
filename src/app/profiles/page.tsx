import { Suspense } from "react";
import { PlayerProfiles } from "@/components/player-profiles";
export default function ProfilesPage(){return <Suspense fallback={<p role="status">Loading profiles…</p>}><PlayerProfiles/></Suspense>;}
