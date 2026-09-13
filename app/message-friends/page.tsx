import { Suspense } from "react";
import { MessageFriendsPage } from "../../components/chat/message-friends-page";

export default function MessageFriendsRoute(){return <Suspense fallback={<main className="min-h-screen bg-[#061120]"/>}><MessageFriendsPage/></Suspense>}
