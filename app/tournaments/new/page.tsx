import type { Metadata } from "next";
import { BottomNav, TopBar } from "../../../components/navigation";
import { CreateTournament } from "../../../components/tournaments/create-tournament";

export const metadata: Metadata = { title: "Create Tournament | MatchUp", description: "Create a football tournament on MatchUp." };

export default function NewTournamentPage() {
  return <><CreateTournament /><TopBar /><BottomNav /></>;
}
