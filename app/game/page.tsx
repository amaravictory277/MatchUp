import type { Metadata } from "next";
import { BottomNav } from "../../components/navigation";
import { LiveFootballHomeFeature } from "../../components/home/live-football-feature";

export const metadata: Metadata = {
  title: "Game | MatchUp",
  description: "Find football competitions and tournaments on MatchUp.",
};

export default function GamePage() {
  return (
    <main className="app-shell min-h-screen pb-28">
      <LiveFootballHomeFeature mode="home" />
      <BottomNav />
    </main>
  );
}
