import type { Metadata } from "next";
import { BottomNav, TopBar } from "../../components/navigation";
import { ReadyPlayersPage } from "../../components/ready/ready-players-page";
export const metadata: Metadata={title:"Ready Players | MatchUp",description:"Find real MatchUp players ready for a quick match."};
export default function ReadyPlayersRoute(){return <><TopBar/><ReadyPlayersPage/><BottomNav/></>}
