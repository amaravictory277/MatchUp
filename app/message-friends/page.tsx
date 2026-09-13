import type { Metadata } from "next";
import { BottomNav, TopBar } from "../../components/navigation";
import { FriendsPage } from "../../components/friends/friends-page";

export const metadata: Metadata={title:"Messages | MatchUp",description:"Message friends and connect with MatchUp players."};
export default function MessageFriendsRoute(){return <><TopBar/><FriendsPage/><BottomNav/></>;}
