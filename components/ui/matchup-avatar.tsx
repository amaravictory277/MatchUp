"use client";

import { useEffect, useMemo, useState } from "react";

type AvatarProfile = { id?: string; display_name?: string | null; username?: string | null; avatar_path?: string | null };

type Props = {
  profile?: AvatarProfile | null;
  size?: "sm" | "md" | "lg";
  alt?: string;
  className?: string;
  group?: boolean;
};

const sizeClass = { sm: "size-10", md: "size-12", lg: "size-16" };
const palettes = [
  ["#123a63", "#43a8ff", "#d8f0ff"],
  ["#183f35", "#35c58a", "#d8fff0"],
  ["#49321c", "#ffb454", "#fff0d5"],
  ["#3d244d", "#c87cff", "#f3ddff"],
  ["#173b4b", "#48d1e5", "#dcfbff"],
];

function hash(value: string) { let h = 0; for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0; return Math.abs(h); }
function label(profile?: AvatarProfile | null) { return profile?.display_name || profile?.username || "MatchUp Player"; }

export function MatchUpAvatar({ profile, size = "md", alt, className = "", group = false }: Props) {
  const [failed, setFailed] = useState(false);
  const [accent, setAccent] = useState<string | null>(null);
  const key = profile?.id || profile?.avatar_path || "matchup-default";
  const palette = palettes[hash(key) % palettes.length];
  const name = label(profile);

  useEffect(() => {
    setFailed(false);
    setAccent(null);
    const src = profile?.avatar_path;
    if (!src || !/^https?:\/\//i.test(src)) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        const side = 24;
        canvas.width = side;
        canvas.height = side;
        ctx.drawImage(img, 0, 0, side, side);
        const pixels = ctx.getImageData(0, 0, side, side).data;
        const bins = new Map<string, { weight: number; r: number; g: number; b: number }>();
        for (let i = 0; i < pixels.length; i += 4) {
          const a = pixels[i + 3];
          if (a < 160) continue;
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          const brightness = (r + g + b) / 3;
          if (brightness > 235 || brightness < 22) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max - min < 28) continue;
          const qr = Math.round(r / 24) * 24, qg = Math.round(g / 24) * 24, qb = Math.round(b / 24) * 24;
          const k = `${qr},${qg},${qb}`;
          const weight = 1 + (max - min) / 255;
          const current = bins.get(k) || { weight: 0, r: qr, g: qg, b: qb };
          current.weight += weight;
          bins.set(k, current);
        }
        const winner = [...bins.values()].sort((a, b) => b.weight - a.weight)[0];
        if (winner) {
          const lift = Math.max(winner.r, winner.g, winner.b) < 115 ? 1.45 : 1;
          const rgb = [winner.r * lift, winner.g * lift, winner.b * lift].map(v => Math.min(255, Math.round(v)));
          if (!cancelled) setAccent(`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
        }
      } catch {
        // Some storage hosts disallow canvas reads; keep the safe MatchUp accent.
      }
    };
    img.onerror = () => { if (!cancelled) setFailed(true); };
    img.src = src;
    return () => { cancelled = true; };
  }, [profile?.avatar_path]);

  const background = useMemo(() => `linear-gradient(145deg, ${palette[0]}, ${palette[1]})`, [palette]);
  return <span className={`relative inline-grid shrink-0 overflow-hidden rounded-[24%] ${sizeClass[size]} ${className}`} style={{ background }}>
    {profile?.avatar_path && !failed ? <img src={profile.avatar_path} alt={alt ?? name} className="size-full object-cover" loading="lazy" onError={() => setFailed(true)} /> : <DefaultAvatar group={group} palette={palette} label={name} />}
  </span>;
}

function DefaultAvatar({ group, palette, label }: { group: boolean; palette: string[]; label: string }) {
  const n = hash(label);
  const skin = ["#f4c7a1", "#9d6545", "#6b3e2a", "#e5ad82"][n % 4];
  const shirt = ["#eaf6ff", "#42a8ff", "#35c58a", "#ffb454"][n % 4];
  if (group) return <svg viewBox="0 0 100 100" className="size-full" aria-label="MatchUp group avatar" role="img"><rect width="100" height="100" rx="24" fill={palette[0]}/><circle cx="33" cy="42" r="18" fill={skin}/><circle cx="67" cy="42" r="18" fill={skin}/><circle cx="50" cy="30" r="16" fill="#f0b58e"/><path d="M13 91c2-18 13-27 28-27s26 9 28 27" fill={shirt}/><path d="M39 91c2-18 13-27 28-27s24 9 26 27" fill={palette[1]}/><path d="M28 91c2-14 10-21 22-21s20 7 22 21" fill="#eaf6ff"/></svg>;
  return <svg viewBox="0 0 100 100" className="size-full" aria-label="MatchUp default avatar" role="img"><rect width="100" height="100" rx="24" fill={palette[0]}/><circle cx="50" cy="40" r="22" fill={skin}/><path d="M28 35c2-18 13-27 23-27 13 0 23 10 22 29-7-7-14-10-23-10-7 0-15 3-22 8Z" fill="#172231"/><circle cx="42" cy="41" r="3" fill="#172231"/><circle cx="58" cy="41" r="3" fill="#172231"/><path d="M39 52c7 6 15 6 22 0" fill="none" stroke="#172231" strokeWidth="3" strokeLinecap="round"/><path d="M24 100c1-25 12-35 26-35s25 10 26 35" fill={shirt}/><path d="M44 66l6 10 6-10" fill="#fff" opacity=".9"/></svg>;
}
