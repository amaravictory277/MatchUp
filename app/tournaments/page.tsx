import type { Metadata } from "next";
import { BottomNav } from "../../components/navigation";
import { TournamentList } from "../../components/tournaments/tournament-list";

export const metadata: Metadata = { title: "Tournaments | MatchUp", description: "Discover MatchUp football tournaments." };

export default function TournamentsPage() {
  return <><TournamentList /><BottomNav /></>;
}
