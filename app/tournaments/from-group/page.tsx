import type { Metadata } from "next";
import { GroupTournamentCreator } from "../../../components/tournaments/group-tournament-creator";
import { BottomNav, TopBar } from "../../../components/navigation";

export const metadata: Metadata = { title: "Create Group Tournament | MatchUp", description: "Create a MatchUp tournament from a group chat." };

export default function GroupTournamentPage() {
  return <><GroupTournamentCreator /><TopBar /><BottomNav /></>;
}
