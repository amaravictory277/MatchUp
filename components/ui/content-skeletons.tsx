"use client";

export function FriendCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl border border-[#18365f] bg-[#071426] p-3">
          <div className="size-12 shrink-0 rounded-full bg-[#12385a]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-28 rounded bg-[#12385a]" />
            <div className="h-2.5 w-40 rounded bg-[#0d2945]" />
          </div>
          <div className="h-9 w-24 rounded-xl bg-[#12385a]" />
        </div>
      ))}
    </div>
  );
}

export function TournamentCardSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-[28px] border border-[#18365f] bg-[#071426]">
          <div className="h-[184px] bg-[#12385a] sm:h-[206px]" />
          <div className="space-y-3 p-4">
            <div className="h-2.5 w-32 rounded bg-[#12385a]" />
            <div className="h-6 w-3/4 rounded bg-[#12385a]" />
            <div className="h-3 w-full rounded bg-[#0d2945]" />
            <div className="h-3 w-2/3 rounded bg-[#0d2945]" />
            <div className="flex justify-between">
              <div className="h-8 w-28 rounded-xl bg-[#12385a]" />
              <div className="h-8 w-20 rounded-xl bg-[#12385a]" />
            </div>
            <div className="h-12 w-full rounded-2xl bg-[#12385a]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReadyPlayerSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl border border-[#18365f] bg-[#071426] p-3">
          <div className="size-12 shrink-0 rounded-full bg-[#12385a]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-[#12385a]" />
            <div className="h-2.5 w-24 rounded bg-[#0d2945]" />
          </div>
          <div className="h-10 w-24 rounded-xl bg-[#12385a]" />
        </div>
      ))}
    </div>
  );
}

export function SearchResultSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-[#18365f] bg-[#071426] p-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-[#12385a]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 rounded bg-[#12385a]" />
              <div className="h-2.5 w-28 rounded bg-[#0d2945]" />
            </div>
            <div className="h-9 w-20 rounded-xl bg-[#12385a]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileCardSkeleton({ count = 1 }: { count?: number }) {
  return <div className="space-y-3">{Array.from({ length: count }, (_, i) => <div key={i} className="animate-pulse overflow-hidden rounded-[28px] border border-[#245b91]/50 bg-[#061426]"><div className="h-[148px] bg-[#12385a] sm:h-[162px]" /><div className="p-4"><div className="-mt-10 size-20 rounded-full border-4 border-[#061426] bg-[#12385a]" /><div className="mt-3 h-5 w-40 rounded bg-[#12385a]" /><div className="mt-2 h-3 w-28 rounded bg-[#0d2945]" /><div className="mt-4 h-10 w-full rounded-xl bg-[#12385a]" /></div></div>)}</div>;
}

export function GroupCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl border border-[#18365f] bg-[#071426] p-3">
          <div className="size-12 rounded-full bg-[#12385a]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-36 rounded bg-[#12385a]" />
            <div className="h-2.5 w-24 rounded bg-[#0d2945]" />
          </div>
          <div className="h-9 w-20 rounded-xl bg-[#12385a]" />
        </div>
      ))}
    </div>
  );
}

export function FeedCardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-[24px] border border-white/10 bg-[#07111d]">
          <div className="h-12 bg-[#12385a]" />
          <div className="aspect-[4/3] bg-[#0d2945]" />
          <div className="flex justify-end gap-2 p-3">
            <div className="size-10 rounded-full bg-[#12385a]" />
            <div className="size-10 rounded-full bg-[#12385a]" />
          </div>
        </div>
      ))}
    </div>
  );
}
