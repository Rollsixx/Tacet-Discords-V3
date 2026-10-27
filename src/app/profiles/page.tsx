import { PageHeading, Panel } from "@/components/ui";
import { BuildDirectory } from "@/components/build-directory";
import { ModerationPanel } from "@/components/moderation-panel";
export default function ProfilesPage() {
  return <><PageHeading eyebrow="Player directory / 02" title="Every player. Every build." description="Find approved builds by Wuthering Waves UID or in-game name. No account required." /><Panel><BuildDirectory mode="profiles" /></Panel><ModerationPanel /></>;
}
