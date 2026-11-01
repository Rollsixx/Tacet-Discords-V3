import type { Metadata } from "next";
import "../admin.css";
import { ModerationPanel } from "@/components/moderation-panel";

export const metadata: Metadata = {
  title: "Black Shores | Tacet Discords",
  robots: { index: false, follow: false },
};

export default function BlackShoresPage() {
  return <div className="blackshores-root"><ModerationPanel /></div>;
}
