import type { Metadata } from "next";
import { BottomNav } from "../../../components/navigation";
import { TournamentClient } from "../../../components/tournaments/tournament-client";

export const metadata: Metadata = { title: "Tournament | MatchUp", description: "Live MatchUp football tournament." };

export default function TournamentPage() {
  return <><TournamentClient /><BottomNav /></>;
}
