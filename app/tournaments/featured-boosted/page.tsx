import type { Metadata } from "next";
import { BottomNav } from "../../../components/navigation";
import { TournamentListingPage } from "../../../components/tournaments/tournament-browser";

export const metadata: Metadata = { title: "Featured Boosted Tournaments | MatchUp", description: "Browse MatchUp's most visible boosted tournaments." };

export default function FeaturedBoostedTournamentsPage() {
  return <><TournamentListingPage category="boosted" title="Featured Boosted Tournaments" /><BottomNav /></>;
}
