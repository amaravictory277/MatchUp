import type { Metadata } from "next";
import { BottomNav } from "../../components/navigation";
import { NotificationsPage } from "../../components/notifications/notifications-page";

export const metadata: Metadata = {
  title: "Notifications | MatchUp",
  description: "Your MatchUp activity and notifications.",
};

export default function NotificationsRoute() {
  return (
    <>
      <NotificationsPage />
      <BottomNav />
    </>
  );
}
