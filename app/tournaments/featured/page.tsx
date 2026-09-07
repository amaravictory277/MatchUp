import type { Metadata } from "next";
import { BottomNav } from "../../../components/navigation";
import { TournamentListingPage } from "../../../components/tournaments/tournament-browser";

export const metadata: Metadata = { title: "Featured Tournaments | MatchUp", description: "Browse featured MatchUp tournaments." };

export default function FeaturedTournamentsPage() {
  return <><TournamentListingPage category="featured" title="Featured Tournaments" /><BottomNav /></>;
}
