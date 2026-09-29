"use client";

import { useState } from "react";

type MatchUpImageProps = { src: string; alt?: string; className?: string; brandPosition?: 'left' | 'center' | 'right' };

export function MatchUpImage({ src, alt = '', className = '', brandPosition = 'center' }: MatchUpImageProps) {
  const [loaded, setLoaded] = useState(false);
  const position = brandPosition === 'left' ? 'left-[22%]' : brandPosition === 'right' ? 'left-[68%]' : 'left-1/2';
  return <div className={`relative overflow-hidden ${className}`}>
    <div aria-hidden="true" className={`absolute inset-0 bg-[#0b3154] transition-opacity duration-300 ${loaded ? "opacity-0" : "opacity-100"}`} />
    <img src={src} alt={alt} className={`relative h-full w-full object-cover transition-[filter,opacity] duration-300 ${loaded ? "opacity-100 blur-0" : "opacity-70 blur-[8px]"}`} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} />
    <span aria-hidden="true" className={`pointer-events-none absolute top-[24%] ${position} -translate-x-1/2 -translate-y-1/2 -rotate-[4deg] whitespace-nowrap text-[clamp(9px,1.9vw,18px)] font-black italic tracking-[-.04em] text-white drop-shadow-[0_2px_3px_rgba(0,0,0,.9)] [text-shadow:0_1px_3px_rgba(0,0,0,.9)]`}>MatchUp</span>
  </div>;
}
