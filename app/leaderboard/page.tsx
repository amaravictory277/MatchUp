"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatHub } from "../../components/chat/chat-hub";
import { ChatDeepLink } from "../../components/chat/chat-deep-link";
import { MessageInteractionLayer } from "../../components/chat/message-interaction-layer";
function ChatRoute(){const params=useSearchParams();return <main className="min-h-screen bg-[#061120]"><ChatHub/><ChatDeepLink groupId={params.get("group")||undefined} friendId={params.get("friend")||undefined}/><MessageInteractionLayer/></main>}
export default function LeaderboardPage(){return <Suspense fallback={<main className="min-h-screen bg-[#061120]"/>}><ChatRoute/></Suspense>}
