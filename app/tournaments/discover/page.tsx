import type { Metadata } from "next";
import { BottomNav, TopBar } from "../../../components/navigation";
import { TournamentListingPage } from "../../../components/tournaments/tournament-browser";
export const metadata: Metadata = { title: "Discover Tournaments | MatchUp", description: "Find public MatchUp tournaments and competitions." };
export default function DiscoverTournamentsPage() { return <><main className="app-shell"><TopBar /></main><TournamentListingPage category="discover" title="Discover Tournaments" /><BottomNav /></>; }
