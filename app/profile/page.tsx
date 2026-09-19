import { Suspense } from "react";
import { ProfilePage } from "../../components/profile/profile-page";

export default function ProfileRoute() {
  return (
    <Suspense fallback={<main className="profile-page app-shell"><div className="surface-card p-10 text-center text-sm text-[#7892ac]">Loading profile…</div></main>}>
      <ProfilePage />
    </Suspense>
  );
}
