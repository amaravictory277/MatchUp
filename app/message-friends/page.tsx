import { Suspense } from "react";
import { MessageFriendsPageV2 } from "../../components/chat/message-friends-page-v2";

export default function MessageFriendsRoute(){return <Suspense fallback={<main className="min-h-screen bg-[#061120]"/>}><MessageFriendsPageV2/></Suspense>}
