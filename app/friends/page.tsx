import type { Metadata } from "next";
import { BottomNav, TopBar } from "../../components/navigation";
import { FriendsPage } from "../../components/friends/friends-page";

export const metadata: Metadata={title:"Friends | MatchUp",description:"Find and connect with football players on MatchUp."};

export default function FriendsRoute(){return <><TopBar/><FriendsPage/><BottomNav/></>;}
