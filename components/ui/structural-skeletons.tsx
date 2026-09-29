import { cn } from "../../lib/utils";

export function FriendCardSkeleton({ className }: { className?: string }) {
  return <div className={cn("flex items-center gap-3 rounded-2xl border border-[#18365f] bg-[#071426] p-3 animate-pulse", className)}>
    <div className="size-12 shrink-0 rounded-full bg-[#12385a]" />
    <div className="min-w-0 flex-1 space-y-2">
      <div className="h-3 w-28 rounded bg-[#12385a]" />
      <div className="h-2.5 w-40 max-w-full rounded bg-[#0d2945]" />
    </div>
    <div className="h-9 w-24 rounded-xl bg-[#12385a]" />
  </div>;
}

export function PlayerCardSkeleton({ className }: { className?: string }) {
  return <div className={cn("overflow-hidden rounded-[28px] border border-[#18365f] bg-[#071426] animate-pulse", className)}>
    <div className="h-28 bg-[#0d2945]" />
    <div className="relative px-4 pb-4">
      <div className="-mt-8 size-16 rounded-full border-4 border-[#071426] bg-[#12385a]" />
      <div className="mt-3 h-4 w-32 rounded bg-[#12385a]" />
      <div className="mt-2 h-3 w-24 rounded bg-[#0d2945]" />
      <div className="mt-4 h-10 w-full rounded-xl bg-[#12385a]" />
    </div>
  </div>;
}

export function TournamentCardSkeleton({ className }: { className?: string }) {
  return <div className={cn("overflow-hidden rounded-[24px] border border-[#18365f] bg-[#071426] animate-pulse", className)}>
    <div className="aspect-[16/9] bg-[#0d2945]" />
    <div className="p-4">
      <div className="h-4 w-3/4 rounded bg-[#12385a]" />
      <div className="mt-2 h-3 w-1/2 rounded bg-[#0d2945]" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="h-8 rounded-xl bg-[#0d2945]" />
        <div className="h-8 rounded-xl bg-[#0d2945]" />
      </div>
      <div className="mt-3 h-10 rounded-xl bg-[#12385a]" />
    </div>
  </div>;
}

export function FeedCardSkeleton({ className }: { className?: string }) {
  return <div className={cn("aspect-[4/3] w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#07111d] animate-pulse", className)}>
    <div className="relative size-full">
      <div className="absolute left-4 top-4 flex items-center gap-3">
        <div className="size-10 rounded-full bg-[#12385a]" />
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-[#12385a]" />
          <div className="h-2.5 w-16 rounded bg-[#0d2945]" />
        </div>
      </div>
      <div className="absolute bottom-5 left-4 h-8 w-1/2 rounded-full bg-[#12385a]" />
      <div className="absolute bottom-4 right-4 flex gap-2">
        <div className="size-10 rounded-full bg-[#12385a]" />
        <div className="size-10 rounded-full bg-[#12385a]" />
      </div>
    </div>
  </div>;
}

export function GroupCardSkeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-2xl border border-[#18365f] bg-[#071426] p-4 animate-pulse", className)}>
    <div className="flex items-center gap-3">
      <div className="size-12 rounded-full bg-[#12385a]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-32 rounded bg-[#12385a]" />
        <div className="h-2.5 w-20 rounded bg-[#0d2945]" />
      </div>
    </div>
    <div className="mt-4 h-9 w-full rounded-xl bg-[#12385a]" />
  </div>;
}

export function SectionSkeletons({ kind, count = 2 }: { kind: "player" | "tournament" | "feed" | "group"; count?: number }) {
  const Item = kind === "player" ? PlayerCardSkeleton : kind === "tournament" ? TournamentCardSkeleton : kind === "feed" ? FeedCardSkeleton : GroupCardSkeleton;
  return <div className={cn("gap-3", kind === "feed" ? "space-y-4" : "grid sm:grid-cols-2")}>{Array.from({ length: count }, (_, i) => <Item key={i} />)}</div>;
}
