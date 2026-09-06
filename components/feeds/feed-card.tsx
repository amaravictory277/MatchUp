"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Pause,
  Play,
  Send,
} from "lucide-react";
import { formatCount, type Post } from "./data";

type FeedCardProps = {
  post: Post;
  onToggleLike: (id: string) => void;
  onToggleFollow: (id: string) => void;
  onComment: (id: string, text: string) => void;
  onShare: (id: string) => void;
};

export function FeedCard({
  post,
  onToggleLike,
  onToggleFollow,
  onComment,
  onShare,
}: FeedCardProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [dragStartX, setDragStartX] = useState<number | null>(null);

  const total = post.media.length;

  const goTo = (next: number) => {
    setIndex((prev) => {
      const clamped = (next + total) % total;
      return clamped;
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragStartX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartX === null) return;
    const delta = e.clientX - dragStartX;
    if (Math.abs(delta) > 40) {
      goTo(delta < 0 ? index + 1 : index - 1);
    }
    setDragStartX(null);
  };

  const submitComment = () => {
    const text = commentText.trim();
    if (!text) return;
    onComment(post.id, text);
    setCommentText("");
    setShowComment(false);
  };

  const [g1, g2] = post.author.gradient;

  return (
    <article className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full text-xs font-black text-white"
          style={{ background: `linear-gradient(140deg, ${g1}, ${g2})` }}
          aria-hidden="true"
        >
          {post.author.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-white">{post.author.name}</p>
          <p className="text-xs text-[#9694aa]">{post.time}</p>
        </div>
        <button
          type="button"
          onClick={() => onToggleFollow(post.id)}
          aria-pressed={post.following}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
            post.following
              ? "border border-[#35334e] bg-transparent text-[#c5c3d4] hover:border-[#7843ee]"
              : "bg-[#6d27ff] text-white shadow-[0_0_18px_rgba(109,39,255,.4)] hover:brightness-110"
          }`}
        >
          {post.following ? "Following" : "Follow"}
        </button>
      </div>

      <div
        className="relative aspect-square w-full touch-pan-y select-none overflow-hidden bg-[#111223]"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {post.media.map((src, i) => (
          <img
            key={src + i}
            src={src || "/placeholder.svg"}
            alt={`${post.author.name} post media ${i + 1}`}
            draggable={false}
            crossOrigin="anonymous"
            className="absolute inset-0 size-full object-cover transition-opacity duration-300"
            style={{ opacity: i === index ? 1 : 0 }}
          />
        ))}

        {post.hasVideo ? (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause" : "Play"}
            className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/25 text-white backdrop-blur-md transition hover:bg-white/35"
          >
            {playing ? <Pause size={26} /> : <Play size={26} className="ml-1" />}
          </button>
        ) : null}

        {total > 1 ? (
          <>
            <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white">
              {index + 1}/{total}
            </span>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous media"
              className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/65"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next media"
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/65"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
              {post.media.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to media ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="p-4">
        <p className="text-sm leading-6 text-[#e7e5f2]">{post.caption}</p>

        <div className="mt-4 flex items-center gap-6 text-sm font-semibold">
          <button
            type="button"
            onClick={() => onToggleLike(post.id)}
            aria-pressed={post.liked}
            className={`flex items-center gap-2 transition ${
              post.liked ? "text-[#ff4d6d]" : "text-[#c5c3d4] hover:text-white"
            }`}
          >
            <Heart size={20} fill={post.liked ? "currentColor" : "none"} />
            {formatCount(post.likes)}
          </button>
          <button
            type="button"
            onClick={() => setShowComment((s) => !s)}
            aria-expanded={showComment}
            className="flex items-center gap-2 text-[#c5c3d4] transition hover:text-white"
          >
            <MessageCircle size={20} />
            {formatCount(post.comments)}
          </button>
          <button
            type="button"
            onClick={() => onShare(post.id)}
            className="flex items-center gap-2 text-[#c5c3d4] transition hover:text-white"
          >
            <Send size={19} />
            {formatCount(post.shares)}
          </button>
        </div>

        {showComment ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  submitComment();
                }
              }}
              placeholder="Add a comment..."
              className="flex-1 rounded-full border border-[#26263d] bg-[#0d0e20] px-4 py-2 text-sm text-white outline-none placeholder:text-[#6f6d83] focus:border-[#7843ee]"
            />
            <button
              type="button"
              onClick={submitComment}
              className="rounded-full bg-[#6d27ff] px-4 py-2 text-xs font-bold text-white transition hover:brightness-110"
            >
              Post
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
