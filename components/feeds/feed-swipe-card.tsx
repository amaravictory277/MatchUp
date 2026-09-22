"use client";

import { useEffect, useRef, useState } from "react";
import { FeedCard } from "./feed-card";
import type { Post } from "./data";

type FeedSwipeCardProps = {
  posts: Post[];
  onToggleLike: (id: string) => void;
  onToggleFollow: (id: string) => void;
  onComment: (id: string, text: string) => void;
  onEditComment: (postId: string, commentId: string, text: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
  onShare: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, caption: string) => void;
  onToggleSave: (id: string) => void;
  onDownload: (id: string, type: "image" | "video") => void;
  onOpenPost: (id: string) => void;
  onOpenMedia: (id: string, index: number) => void;
};

export function FeedSwipeCard({
  posts,
  onToggleLike,
  onToggleFollow,
  onComment,
  onEditComment,
  onDeleteComment,
  onShare,
  onDelete,
  onEdit,
  onToggleSave,
  onDownload,
  onOpenPost,
  onOpenMedia,
}: FeedSwipeCardProps) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [endReached, setEndReached] = useState(false);
  const [commentRequest, setCommentRequest] = useState(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const current = posts[index] || null;
  const nextPost = dragX < 0 ? posts[index + 1] : null;
  const swipeViewport = typeof window === "undefined" ? 420 : Math.max(420, window.innerWidth);
  const progress = Math.min(1, Math.abs(dragX) / swipeViewport);

  useEffect(() => {
    setIndex((value) => Math.min(value, Math.max(0, posts.length - 1)));
  }, [posts.length]);

  useEffect(() => {
    setDragX(0);
    setAnimating(false);
  }, [current?.id]);

  const finishLeft = () => {
    if (index >= posts.length - 1) {
      setEndReached(true);
      window.setTimeout(() => setEndReached(false), 1800);
    } else {
      setIndex((value) => Math.min(value + 1, posts.length - 1));
    }
    setDragX(0);
    setAnimating(false);
  };

  const commitLeft = () => {
    if (!current || animating) return;
    setAnimating(true);
    const width = Math.max(320, document.documentElement.clientWidth);
    const distance = Math.max(window.innerWidth + 100, width + 220);
    setDragX(-distance);
    window.setTimeout(finishLeft, 340);
  };

  const commitRightComment = () => {
    if (!current || animating) return;
    setAnimating(true);
    setDragX(Math.min(150, Math.max(110, window.innerWidth * 0.18)));
    window.setTimeout(() => {
      setDragX(0);
      setAnimating(false);
      setCommentRequest((value) => value + 1);
    }, 220);
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (animating || event.isPrimary === false) return;
    startRef.current = { x: event.clientX, y: event.clientY };
    pointerIdRef.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
  };

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || animating || pointerIdRef.current !== event.pointerId) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.12) {
      setDragX(dx);
    }
  };

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || animating || pointerIdRef.current !== event.pointerId) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    startRef.current = null;
    pointerIdRef.current = null;
    const horizontal = Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.12;
    if (!horizontal) {
      setDragX(0);
      return;
    }
    if (dx < 0) commitLeft();
    else commitRightComment();
  };

  const pointerCancel = () => {
    startRef.current = null;
    pointerIdRef.current = null;
    if (!animating) setDragX(0);
  };

  if (!current) return null;

  const feedCard = (post: Post, active: boolean, request = 0) => (
    <FeedCard
      post={post}
      active={active}
      commentRequest={request}
      onToggleLike={onToggleLike}
      onToggleFollow={onToggleFollow}
      onComment={onComment}
      onEditComment={onEditComment}
      onDeleteComment={onDeleteComment}
      onShare={onShare}
      onDelete={onDelete}
      onEdit={onEdit}
      onToggleSave={onToggleSave}
      onDownload={onDownload}
      onOpenPost={onOpenPost}
      onOpenMedia={onOpenMedia}
    />
  );

  return (
    <>
      <div className="relative w-full overflow-visible rounded-[28px]" style={{ touchAction: "pan-y" }}>
        {nextPost ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 w-full origin-center"
            aria-hidden="true"
            style={{
              transform: `translate3d(0,0,0) scale(${0.2 + progress * 0.8})`,
              transition: animating ? "transform 340ms cubic-bezier(.16,1,.3,1)" : "none",
              willChange: "transform",
            }}
          >
            {feedCard(nextPost, false)}
          </div>
        ) : null}

        <div
          className="relative z-20 w-full"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerCancel}
          style={{
            transform: `translate3d(${dragX}px,0,0) rotate(${Math.max(-5, Math.min(5, dragX / 70))}deg)`,
            transition: animating ? "transform 340ms cubic-bezier(.16,1,.3,1)" : "none",
            willChange: "transform",
          }}
        >
          {feedCard(current, true, commentRequest)}
        </div>
      </div>

      {endReached ? (
        <div className="mt-3 w-full overflow-hidden rounded-2xl border border-[#3a99eb] bg-[#167bd1] px-2.5 py-3 text-center shadow-[0_10px_28px_rgba(22,123,209,.24)]" aria-live="polite">
          <span className="block whitespace-nowrap text-[11px] font-black text-white sm:text-sm">You have reached the end</span>
        </div>
      ) : null}

      {posts.length > 1 ? (
        <div className="mt-3 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-1" aria-label={`Feed card ${Math.min(index + 1, posts.length)} of ${posts.length}`}>
          <span className="justify-self-start whitespace-nowrap text-[9px] font-semibold text-[#7892ac] sm:text-[10px]">← Swipe left for next</span>
          <div className="flex items-center justify-center gap-1.5">
            {posts.map((post, dotIndex) => (
              <span key={post.id} className={`rounded-full transition-all duration-200 ${dotIndex === index ? "h-1.5 w-5 bg-[#70c1ff]" : "size-1.5 bg-[#31597f]"}`} aria-hidden="true" />
            ))}
          </div>
          <span className="justify-self-end whitespace-nowrap text-[9px] font-semibold text-[#7892ac] sm:text-[10px]">Swipe right for comments →</span>
        </div>
      ) : null}
    </>
  );
}
