"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatHub } from "../../components/chat/chat-hub";
import { ChatDeepLink } from "../../components/chat/chat-deep-link";
import { MessageInteractionLayer } from "../../components/chat/message-interaction-layer";
function ChatRoute(){const params=useSearchParams();return <main className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#061120]"><ChatHub/><ChatDeepLink groupId={params.get("group")||undefined} friendId={params.get("friend")||undefined} createGroup={params.get("create")==="group"}/><MessageInteractionLayer/></main>}
export default function LeaderboardPage(){return <Suspense fallback={<main className="h-[100dvh] bg-[#061120]"/>}><ChatRoute/></Suspense>}
