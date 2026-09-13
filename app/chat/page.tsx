import type { Metadata } from "next";
import { ChatHub } from "../../components/chat/chat-hub";

export const metadata: Metadata={title:"Chat | MatchUp",description:"MatchUp groups and private conversations."};
export default function ChatRoute(){return <main className="app-shell min-h-screen pb-24"><ChatHub/></main>;}
