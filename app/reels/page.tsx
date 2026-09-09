import type { Metadata } from "next";
import { ReelsViewer } from "../../components/feeds/reels-viewer";
export const metadata: Metadata={title:"Reels | MatchUp",description:"Watch MatchUp football videos."};
export default function ReelsPage(){return <ReelsViewer/>;}
