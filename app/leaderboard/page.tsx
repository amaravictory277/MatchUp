import { BottomNav, TopBar } from "../../components/navigation";
import { ChatHub } from "../../components/chat/chat-hub";

export default function LeaderboardPage() {
  return (
    <>
      <main className="app-shell pb-28">
        <TopBar />
        <ChatHub />
      </main>
      <BottomNav />
    </>
  );
}
