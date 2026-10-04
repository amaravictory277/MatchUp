import type { Metadata } from "next";
import { BottomNav } from "../../components/navigation";
import { PlayGame } from "../../components/game/play-game";

export const metadata: Metadata = {
  title: "Play Game | MatchUp",
  description: "Play the MatchUp football game prototype.",
};

export default function PlayGamePage() {
  return (
    <main className="min-h-screen bg-[#020a14]">
      <PlayGame />
      <BottomNav />
    </main>
  );
}
