import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupTournamentCreator } from "../../../components/tournaments/group-tournament-creator";
import { BottomNav, TopBar } from "../../../components/navigation";

export const metadata: Metadata = { title: "Create Group Tournament | MatchUp", description: "Create a MatchUp tournament from a group chat." };

export default function GroupTournamentPage() {
  return <><Suspense fallback={<main className="app-shell"><section className="surface-card p-5 text-sm text-[var(--muted)]">Loading group tournament creator…</section></main>}><GroupTournamentCreator /></Suspense><TopBar /><BottomNav /></>;
}
