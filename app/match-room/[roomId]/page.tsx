import { MatchRoom } from "../../../components/match/match-room";

export default async function MatchRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <MatchRoom roomId={roomId} />;
}
