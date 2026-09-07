import type { Metadata } from "next";
import { BottomNav, TopBar } from "../../../../../components/navigation";
import { MatchClient } from "../../../../../components/tournaments/match-client";

export const metadata: Metadata = { title: "Match Center | MatchUp", description: "Manage a MatchUp football match." };

export default function MatchPage() {
  return <><MatchClient /><TopBar /><BottomNav /></>;
}
