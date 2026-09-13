import type { Metadata } from "next";
import { BottomNav, TopBar } from "../../components/navigation";
import { GroupsPage } from "../../components/groups/groups-page";

export const metadata: Metadata={title:"Groups | MatchUp",description:"Your MatchUp football communities."};

export default function GroupsRoute(){return <><TopBar/><GroupsPage/><BottomNav/></>}
