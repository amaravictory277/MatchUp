"use client";

import { useMemo } from "react";
import { usePersonalization } from "./personalization-provider";

export function NameEffect({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { preferences } = usePersonalization();
  return <span className={`matchup-name-effect matchup-name-effect--${preferences.selected_name_effect} ${className}`}>{children}</span>;
}

export function ProfileFrame({ src, alt, className = "", fallback }: { src?: string | null; alt: string; className?: string; fallback?: React.ReactNode }) {
  const { preferences } = usePersonalization();
  const frame = preferences.selected_profile_frame;
  return <span className={`matchup-profile-frame matchup-profile-frame--${frame} ${className}`}><span className="matchup-profile-frame__media">{src ? <img src={src} alt={alt} className="size-full object-cover" /> : fallback}</span><span aria-hidden="true" className="matchup-profile-frame__ring" /></span>;
}

export function ChatBubbleEffect({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { preferences } = usePersonalization();
  return <span className={`matchup-chat-bubble matchup-chat-bubble--${preferences.selected_chat_bubble} matchup-chat-animation--${preferences.selected_chat_animation} ${className}`}>{children}</span>;
}

export function ChatTextEffect({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { preferences } = usePersonalization();
  return <span className={`matchup-chat-text--${preferences.selected_chat_text} ${className}`}>{children}</span>;
}

export function ProfileTheme({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { preferences } = usePersonalization();
  return <div className={`matchup-profile-theme matchup-profile-theme--${preferences.selected_profile_theme} ${className}`}>{children}</div>;
}

export function PersonalizationPreviewName({ value }: { value: string }) {
  return <NameEffect>{value}</NameEffect>;
}
