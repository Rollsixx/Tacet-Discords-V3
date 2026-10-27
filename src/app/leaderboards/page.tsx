import { PageHeading, Panel } from "@/components/ui";
import { BuildDirectory } from "@/components/build-directory";
export default function LeaderboardsPage() {
  return <><PageHeading eyebrow="Competitive rankings / 03" title="Solo Leaderboards." description="Approved builds, with official rankings reserved for verified calculation results." /><Panel><BuildDirectory mode="leaderboards" /></Panel></>;
}
