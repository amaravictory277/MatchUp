import type { Metadata } from "next";
import { Suspense } from "react";
import { ReelsViewer } from "../../components/feeds/reels-viewer";
export const metadata: Metadata={title:"Reels | MatchUp",description:"Watch MatchUp football videos."};
export default function ReelsPage(){return <Suspense fallback={<main className="fixed inset-0 grid place-items-center bg-black text-white"><p>Loading Reels…</p></main>}><ReelsViewer/></Suspense>;}
