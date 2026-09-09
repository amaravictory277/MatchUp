import { Suspense } from "react";
import { PostDetail } from "../../../../components/feeds/post-detail";

export default function PostDetailPage(){return <Suspense fallback={<main className="min-h-screen bg-[#061120] p-5 text-white">Loading post…</main>}><PostDetail/></Suspense>;}
