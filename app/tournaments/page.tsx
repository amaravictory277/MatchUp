import type { Metadata } from "next";
import { BottomNav, TopBar } from "../../components/navigation";
import { TournamentList } from "../../components/tournaments/tournament-list";

export const metadata: Metadata = { title: "Tournaments | MatchUp", description: "Discover and manage MatchUp football tournaments." };

export default function TournamentsPage() {
  return <><TournamentList /><TopBar /><BottomNav /></>;
}
