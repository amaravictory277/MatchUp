"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { ChatHub } from "../../../../components/chat/chat-hub";
import { createBrowserSupabaseClient } from "../../../../lib/supabase/client";

export default function TournamentGroupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (active) { setDenied(true); setLoading(false); }
        return;
      }
      const { data, error } = await supabase.rpc("get_tournament_group_info", { p_tournament: params.id });
      const row = Array.isArray(data) ? data[0] : data;
      if (!active) return;
      if (error || !row?.group_id) {
        setDenied(true);
        setLoading(false);
        return;
      }
      setGroupId(row.group_id);
      setDenied(false);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [params.id, supabase]);

  if (loading) return <main className="h-[100dvh] bg-[#061120] p-4"><div className="h-14 animate-pulse rounded-2xl bg-[#0b2139]" /></main>;

  if (denied) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#061120] p-5 text-white">
        <section className="w-full max-w-md rounded-[28px] border border-[#173d67] bg-[#071426] p-6 text-center">
          <p className="text-lg font-black">Tournament group access is restricted</p>
          <p className="mt-2 text-sm leading-6 text-[#7892ac]">Join this tournament first to enter its private group.</p>
          <button type="button" onClick={() => router.push(`/tournaments/${params.id}`)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1674cf] px-4 py-3 text-sm font-black text-white">
            <ArrowLeft size={16} /> View Tournament
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] bg-[#061120]">
      <ChatHub
        initialGroupId={groupId}
        tournamentMode
        onBack={() => router.back()}
        onViewDetails={() => router.push(`/tournaments/${params.id}`)}
      />
    </main>
  );
}
