import { Suspense } from "react";
import { MediaViewer } from "../../../../components/feeds/media-viewer";

export default function MediaPage(){return <Suspense fallback={<main className="fixed inset-0 grid place-items-center bg-black text-white">Loading media…</main>}><MediaViewer/></Suspense>;}
