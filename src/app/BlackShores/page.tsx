import type { Metadata } from "next";
import { PageHeading } from "@/components/ui";
import { ModerationPanel } from "@/components/moderation-panel";

export const metadata: Metadata = {
  title: "Black Shores | Tacet Discords",
  robots: { index: false, follow: false },
};

export default function BlackShoresPage() {
  return <div className="admin-workspace"><PageHeading eyebrow="Black Shores / Administration" title="Review desk." description="Private moderation workspace for Tacet Discords." /><ModerationPanel /></div>;
}
