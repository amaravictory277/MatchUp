"use client";

import Image from "next/image";

export type MatchUpAvatarProfile = { id?: string | null; display_name?: string | null; username?: string | null; avatar_path?: string | null };

const DEFAULTS = ["/avatars/matchup-avatar-1.svg", "/avatars/matchup-avatar-2.svg", "/avatars/matchup-avatar-3.svg"];

export function matchupAvatarIndex(id = "") {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % DEFAULTS.length;
}

export function profileName(profile?: MatchUpAvatarProfile | null) {
  return profile?.display_name?.trim() || profile?.username?.trim() || "MatchUp Player";
}

export function MatchUpAvatar({ profile, size = 48, className = "", alt }: { profile?: MatchUpAvatarProfile | null; size?: number; className?: string; alt?: string }) {
  const src = profile?.avatar_path || DEFAULTS[matchupAvatarIndex(profile?.id || profile?.username || "")];
  return <span className={`matchup-avatar ${className}`} style={{ width: size, height: size }}>
    <Image src={src} alt={alt || `${profileName(profile)} avatar`} width={size} height={size} className="h-full w-full object-cover" unoptimized />
  </span>;
}

export function MatchUpAvatarStack({ profiles, size = 38, max = 6 }: { profiles: MatchUpAvatarProfile[]; size?: number; max?: number }) {
  const visible = profiles.slice(0, max);
  return <div className="matchup-avatar-stack" aria-label={`${profiles.length} members`}>
    {visible.map((profile, index) => <span key={profile.id || profile.username || index} className="matchup-avatar-stack-item" style={{ zIndex: visible.length - index }}><MatchUpAvatar profile={profile} size={size} /></span>)}
    {profiles.length > max ? <span className="matchup-avatar-more" style={{ width: size, height: size }}>+{profiles.length - max}</span> : null}
  </div>;
}
