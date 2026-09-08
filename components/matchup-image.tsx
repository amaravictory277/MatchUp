type MatchUpImageProps = { src: string; alt?: string; className?: string; brandPosition?: 'left' | 'center' | 'right' };

export function MatchUpImage({ src, alt = '', className = '', brandPosition = 'center' }: MatchUpImageProps) {
  const position = brandPosition === 'left' ? 'left-[22%]' : brandPosition === 'right' ? 'left-[68%]' : 'left-1/2';
  return <div className={`relative overflow-hidden ${className}`}><img src={src} alt={alt} className="h-full w-full object-cover" /><span aria-hidden="true" className={`pointer-events-none absolute top-[24%] ${position} -translate-x-1/2 -translate-y-1/2 -rotate-[4deg] whitespace-nowrap text-[clamp(9px,1.9vw,18px)] font-black italic tracking-[-.04em] text-white drop-shadow-[0_2px_3px_rgba(0,0,0,.9)] [text-shadow:0_1px_3px_rgba(0,0,0,.9)]`}>MatchUp</span></div>;
}
