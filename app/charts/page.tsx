import type { Metadata } from "next";
import { BottomNav } from "../../components/navigation";
import { ChartsClient } from "../../components/charts/charts-client";

export const metadata: Metadata = {
  title: "Charts | MatchUp",
  description: "Competition charts for public MatchUp tournaments.",
};

export default function ChartsPage() {
  return (
    <>
      <ChartsClient />
      <BottomNav />
    </>
  );
}
