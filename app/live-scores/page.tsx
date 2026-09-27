import type { Metadata } from "next";
import { BottomNav } from "../../components/navigation";
import { LiveFootballHomeFeature } from "../../components/home/live-football-feature";

export const metadata: Metadata = {
  title: "Live Scores | MatchUp",
  description: "Live football scores and MatchUp match rooms.",
};

export default function LiveScoresPage() {
  return (
    <main className="app-shell min-h-screen pb-28">
      <LiveFootballHomeFeature mode="page" />
      <BottomNav />
    </main>
  );
}
