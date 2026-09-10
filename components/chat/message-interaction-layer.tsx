"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Edit3, Forward, Reply, Trash2, X } from "lucide-react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { MessageForwarder } from "./message-forwarder";

const REACTIONS = ["🔥", "🙌", "😭", "😂", "🙏", "😖"];
type Message = { id: string; group_id?: string; sender_id: string; body: string; deleted_at: string | null; edited_at?: string | null };
type Permission = { own: boolean; canDelete: boolean };

export function MessageInteractionLayer() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [menu, setMenu] = useState<Message | null>(null);
  const [permission, setPermission] = useState<Permission>({ own: false, canDelete: false });
  const [edit, setEdit] = useState<Message | null>(null);
  const [draft, setDraft] = useState("");
  const [forward, setForward] = useState<Message | null>(null);
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number; id: string } | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      start.current = null;
    };
    const down = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button, input, textarea, a, select, [contenteditable='true']")) return;
      const row = target.closest<HTMLElement>("[data-message-id]");
      if (!row) return;
      const id = row.dataset.messageId;
      if (!id) return;
      start.current = { x: e.clientX, y: e.clientY, id };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const s = start.current;
        if (!s || s.id !== id) return;
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const { data } = await supabase
          .from("chat_messages")
          .select("id,group_id,sender_id,body,deleted_at,edited_at")
          .eq("id", id)
          .maybeSingle();
        if (!data) return;
        const message = data as Message;
        let canDelete = message.sender_id === auth.user.id;
        if (message.group_id) {
          const { data: group } = await supabase.from("chat_groups").select("created_by").eq("id", message.group_id).maybeSingle();
          canDelete = canDelete || group?.created_by === auth.user.id;
        }
        setPermission({ own: message.sender_id === auth.user.id, canDelete });
        setMenu(message);
        navigator.vibrate?.(12);
        clear();
      }, 620);
    };
    const move = (e: PointerEvent) => {
      const s = start.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) > 14 || Math.abs(dy) > 14) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        if (dx > 70 && Math.abs(dy) < 42) {
          document.querySelector<HTMLElement>(`[data-message-id=\"${CSS.escape(s.id)}\"]`)?.querySelector<HTMLButtonElement>('button[aria-label="Reply to message"]')?.click();
        }
        start.current = null;
      }
    };
    const up = () => clear();
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    return () => {
      clear();
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
    };
  }, [supabase]);

  const close = () => setMenu(null);
  const react = async (emoji: string) => {
    if (!menu) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: existing } = await supabase.from("chat_message_reactions").select("emoji").eq("message_id", menu.id).eq("user_id", auth.user.id).maybeSingle();
    if (existing?.emoji === emoji) {
      await supabase.from("chat_message_reactions").delete().match({ message_id: menu.id, user_id: auth.user.id, emoji });
    } else {
      if (existing) await supabase.from("chat_message_reactions").delete().match({ message_id: menu.id, user_id: auth.user.id, emoji: existing.emoji });
      await supabase.from("chat_message_reactions").insert({ message_id: menu.id, user_id: auth.user.id, emoji });
    }
    close();
  };
  const copy = async () => {
    if (!menu) return;
    await navigator.clipboard.writeText(menu.body || "");
    setNotice("Copied");
    close();
    window.setTimeout(() => setNotice(""), 1400);
  };
  const reply = () => {
    if (!menu) return;
    document.querySelector<HTMLElement>(`[data-message-id=\"${CSS.escape(menu.id)}\"]`)?.querySelector<HTMLButtonElement>('button[aria-label="Reply to message"]')?.click();
    close();
  };
  const beginEdit = () => {
    if (!menu || !permission.own) return;
    setDraft(menu.body);
    setEdit(menu);
    close();
  };
  const saveEdit = async () => {
    if (!edit || !draft.trim()) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user || auth.user.id !== edit.sender_id) return;
    const { error } = await supabase.from("chat_messages").update({ body: draft.trim(), edited_at: new Date().toISOString(), deleted_at: null }).eq("id", edit.id).eq("sender_id", auth.user.id);
    if (error) setNotice("Could not edit message."); else setNotice("Message edited.");
    setEdit(null);
    window.setTimeout(() => setNotice(""), 1600);
  };
  const remove = async () => {
    if (!menu || !permission.canDelete) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("chat_messages").update({ deleted_at: new Date().toISOString(), edited_at: null }).eq("id", menu.id);
    if (error) setNotice("Could not delete message."); else setNotice("Message deleted.");
    close();
    window.setTimeout(() => setNotice(""), 1600);
  };

  return <>
    {menu ? <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={close} role="dialog" aria-modal="true">
      <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-[#194b7c] bg-[#08182b] p-3 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#36506b]" />
        <p className="px-3 pt-1 text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">React</p>
        <div className="mt-2 flex gap-1 overflow-x-auto px-2 pb-2">
          {REACTIONS.map(r => <button key={r} type="button" onClick={() => void react(r)} className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl hover:bg-[#0b3154]">{r}</button>)}
        </div>
        <div className="mt-1 divide-y divide-white/5 border-t border-white/5">
          <button type="button" onClick={() => void copy()} className="flex w-full items-center gap-3 px-3 py-4 text-left text-sm font-black text-white"><Copy size={18} />Copy</button>
          <button type="button" onClick={reply} className="flex w-full items-center gap-3 px-3 py-4 text-left text-sm font-black text-white"><Reply size={18} />Reply</button>
          <button type="button" onClick={() => { setForward(menu); setMenu(null); }} className="flex w-full items-center gap-3 px-3 py-4 text-left text-sm font-black text-white"><Forward size={18} />Forward</button>
          {permission.own ? <button type="button" onClick={beginEdit} className="flex w-full items-center gap-3 px-3 py-4 text-left text-sm font-black text-white"><Edit3 size={18} />Edit</button> : null}
          {permission.canDelete ? <button type="button" onClick={() => void remove()} className="flex w-full items-center gap-3 px-3 py-4 text-left text-sm font-black text-[#ff9eaa]"><Trash2 size={18} />Delete</button> : null}
        </div>
      </div>
    </div> : null}
    {edit ? <div className="fixed inset-0 z-[135] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-[28px] border border-[#194b7c] bg-[#08182b] p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-black text-white">Editing message</h2><button type="button" onClick={() => setEdit(null)} className="icon-button"><X size={17} /></button></div>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4} className="mt-4 w-full rounded-2xl border border-[#18365f] bg-[#071426] p-3 text-sm text-white outline-none" autoFocus />
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setEdit(null)} className="rounded-xl border border-[#36506b] px-4 py-3 text-xs font-black text-[#b7c9da]">Cancel</button><button type="button" onClick={() => void saveEdit()} disabled={!draft.trim()} className="rounded-xl bg-[#167bd1] px-4 py-3 text-xs font-black text-white disabled:opacity-40">Save</button></div>
      </div>
    </div> : null}
    <MessageForwarder open={Boolean(forward)} onClose={() => setForward(null)} message={forward?.body || ""} />
    {notice ? <div className="fixed bottom-8 left-1/2 z-[160] -translate-x-1/2 rounded-full border border-[#1e6095] bg-[#0a2139] px-4 py-2.5 text-xs font-bold text-white">{notice}</div> : null}
  </>;
}
