"use client";
import { MatchUpAvatar } from "../ui/matchup-avatar";

type Entry = { id: string; label: string; secondary?: string; profile?: { id?: string; display_name?: string|null; username?: string|null; avatar_path?: string|null }; group?: boolean; onClick?: () => void };
type Props = { title: string; description: string; entries: Entry[]; primaryLabel: string; secondaryLabel: string; onPrimary: () => void; onSecondary: () => void; emptyText: string };

export function SidebarSectionCard({ title, description, entries, primaryLabel, secondaryLabel, onPrimary, onSecondary, emptyText }: Props) {
  const shown = entries.slice(0, 2);
  return <section className="mt-5 overflow-hidden rounded-2xl border border-[#214a78] bg-[#071426] shadow-[0_12px_32px_rgba(0,0,0,.16)]">
    <div className="px-3.5 pb-3 pt-3.5">
      <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#66809a]">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-[#7892ac]">{description}</p>
      <div className="mt-3 space-y-1.5">
        {shown.length ? shown.map(entry => <button key={entry.id} type="button" onClick={entry.onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[#0b223c]">
          <MatchUpAvatar profile={entry.profile} group={Boolean(entry.group)} size="sm" className="size-9 rounded-xl" />
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-bold text-white">{entry.label}</strong>{entry.secondary ? <small className="block truncate text-[10px] text-[#7892ac]">{entry.secondary}</small> : null}</span>
        </button>) : <p className="rounded-xl px-2 py-2 text-xs text-[#7892ac]">{emptyText}</p>}
      </div>
    </div>
    <div className="grid grid-cols-2 border-t border-[#214a78]">
      <button type="button" onClick={onPrimary} className="min-w-0 px-2 py-3 text-center text-[11px] font-black text-[#70c1ff] hover:bg-[#0b223c]">{primaryLabel}</button>
      <button type="button" onClick={onSecondary} className="min-w-0 border-l border-[#214a78] px-2 py-3 text-center text-[11px] font-black text-[#70c1ff] hover:bg-[#0b223c]">{secondaryLabel}</button>
    </div>
  </section>;
}
