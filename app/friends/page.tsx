import type { Metadata } from "next";
import { Suspense } from "react";
import { BottomNav, TopBar } from "../../components/navigation";
import { FriendsPage } from "../../components/friends/friends-page";

export const metadata: Metadata={title:"Friends | MatchUp",description:"Find and connect with football players on MatchUp."};

export default function FriendsRoute(){return <><TopBar/><Suspense fallback={<main className="app-shell min-h-screen pb-28"><div className="space-y-3 animate-pulse"><div className="h-10 w-40 rounded bg-[#12385a]"/><div className="h-16 w-full rounded-2xl bg-[#071426]"/><div className="h-48 w-full rounded-[28px] bg-[#071426]"/></div></main>}><FriendsPage/></Suspense><BottomNav/></>;}
