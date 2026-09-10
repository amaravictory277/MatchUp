import type { Metadata } from "next";
import { BottomNav } from "../../components/navigation";
import { FeedQuickActionBridge } from "../../components/feeds/feed-quick-action-bridge";
import { FeedsClient } from "../../components/feeds/feeds-client";

export const metadata: Metadata = {
  title: "Feed | MatchUp",
  description: "Connect, compete, and grow with the MatchUp community feed.",
};

export default function FeedsPage() {
  return (
    <main className="app-shell">
      <FeedQuickActionBridge />
      <FeedsClient />
      <BottomNav />
    </main>
  );
}
