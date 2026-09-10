"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Forward, Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

type Destination = { id: string; kind: "friend" | "group"; label: string };

export function MessageForwarder({ open, onClose, message }: { open: boolean; onClose: () => void; message: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const uid = auth.user.id;
      const [{ data: friendships }, { data: memberships }, { data: general }] = await Promise.all([
        supabase.from("friendships").select("user_id,friend_id").eq("status", "accepted").or(`user_id.eq.${uid},friend_id.eq.${uid}`),
        supabase.from("chat_group_members").select("group_id,chat_groups(id,name,kind)").eq("user_id", uid),
        supabase.from("chat_groups").select("id,name,kind").eq("kind", "general").maybeSingle(),
      ]);
      const ids = ((friendships || []) as any[]).map(r => r.user_id === uid ? r.friend_id : r.user_id);
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,display_name,username").in("id", ids) : { data: [] };
      const friends: Destination[] = (profiles || []).map((p: any) => ({ id: `friend:${p.id}`, kind: "friend", label: p.display_name || p.username || "MatchUp Player" }));
      const groups: Destination[] = (memberships || []).map((r: any) => r.chat_groups).filter((g: any) => g?.kind === "group").map((g: any) => ({ id: `group:${g.id}`, kind: "group", label: g.name }));
      if (general) groups.unshift({ id: `group:${(general as any).id}`, kind: "group", label: "General" });
      if (!cancelled) { setDestinations([...friends, ...groups]); setSelected([]); setNotice(""); }
    };
    void load();
    return () => { cancelled = true; };
  }, [open, supabase]);

  if (!open) return null;
  const toggle = (id: string) => setSelected(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
  const send = async () => {
    if (!selected.length) return;
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setNotice("Sign in required."); setBusy(false); return; }
    try {
      for (const key of selected) {
        const [kind, id] = key.split(":");
        let groupId = id;
        if (kind === "friend") {
          const { data, error } = await supabase.rpc("get_or_create_private_chat", { p_friend: id });
          if (error || !data) throw error || new Error("Could not open private chat");
          groupId = data as string;
        }
        const { error } = await supabase.from("chat_messages").insert({ group_id: groupId, sender_id: auth.user.id, body: message });
        if (error) throw error;
      }
      setNotice("Forwarded successfully.");
      setSelected([]);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not forward message.");
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[140] bg-[#061120] text-white" role="dialog" aria-modal="true">
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <header className="flex items-center gap-3 border-b border-[#18365f] bg-[#08182b] px-4 py-4 sm:px-6">
        <button type="button" onClick={onClose} className="icon-button" aria-label="Back"><ArrowLeft size={19} /></button>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">Forward</p><h2 className="text-xl font-black">Choose recipients</h2></div>
        <span className="text-xs font-bold text-[#7892ac]">{selected.length} selected</span>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="rounded-2xl border border-[#18365f] bg-[#071426] p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#66809a]">Message</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-white">{message}</p></div>
        <div className="mt-5 grid gap-2">{destinations.map(d => <button key={d.id} type="button" onClick={() => toggle(d.id)} className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left ${selected.includes(d.id) ? "border-[#2497ff] bg-[#0b3154]" : "border-[#18365f] bg-[#071426]"}`}>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#0b3154] text-xs font-black text-[#70c1ff]">{d.kind === "group" ? "G" : d.label.slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-black">{d.label}</span>
          <span className={`grid size-6 place-items-center rounded-full border ${selected.includes(d.id) ? "border-[#2497ff] bg-[#167bd1]" : "border-[#4c6b88]"}`}>{selected.includes(d.id) ? <Check size={14} /> : null}</span>
        </button>)}{!destinations.length ? <p className="rounded-2xl border border-dashed border-[#18365f] p-8 text-center text-sm text-[#7892ac]">No eligible recipients.</p> : null}</div>
      </div>
      <footer className="border-t border-[#18365f] bg-[#08182b] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">{notice ? <p className="mb-3 text-center text-xs font-bold text-[#9bd3ff]">{notice}</p> : null}<button type="button" disabled={!selected.length || busy} onClick={() => void send()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#167bd1] px-4 py-3.5 text-sm font-black disabled:opacity-50">{busy ? <Loader2 size={17} className="animate-spin" /> : <Forward size={17} />}Forward</button></footer>
    </div>
  </div>;
}
