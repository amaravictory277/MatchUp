"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Forward,
  Gamepad2,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { formatCount, type Post } from "./data";
import { ContentForwarder } from "../share/content-forwarder";
import { MatchUpVerificationBadge } from "./matchup-verification-badge";
import { PostTagger } from "../share/post-tagger";

type FeedCardProps = {
  post: Post;
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
  onLongPressVideo?: (id: string) => void;
  commentRequest?: number;
  active?: boolean;
};

export function FeedCard({
  post,
  onToggleLike,
  onToggleFollow,
  onComment,
  onEditComment,
  onDeleteComment,
  onShare: _onShare,
  onDelete,
  onEdit,
  onToggleSave,
  onDownload,
  onOpenPost,
  onOpenMedia,
  commentRequest = 0,
  active = true,
}: FeedCardProps) {
  const [index, setIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.caption);
  const [soundOn, setSoundOn] = useState(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  const movedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lastCommentRequestRef = useRef(commentRequest);

  useEffect(() => {
    setIndex(0);
    setDraft(post.caption);
    setShowComments(false);
    setMenuOpen(false);
    setMediaMenuOpen(false);
    setForwardOpen(false);
    setTagOpen(false);
    setEditing(false);
    setSoundOn(false);
  }, [post.id, post.caption]);

  useEffect(() => {
    if (commentRequest !== lastCommentRequestRef.current) {
      lastCommentRequestRef.current = commentRequest;
      if (commentRequest > 0) setShowComments(true);
    }
  }, [commentRequest]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !post.videoUrl) return;

    if (!active) {
      video.pause();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.muted = true;
          video.volume = 0;
          setSoundOn(false);
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.6 },
    );

    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [post.videoUrl, active]);

  const cancelPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const pointerDown = (event: React.PointerEvent<HTMLElement>) => {
    movedRef.current = false;
    longPressTriggeredRef.current = false;
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    cancelPress();
    pressTimerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        longPressTriggeredRef.current = true;
        setMediaMenuOpen(true);
        navigator.vibrate?.(12);
      }
    }, 600);
  };

  const pointerUp = (event: React.PointerEvent<HTMLElement>, mediaIndex: number) => {
    cancelPress();
    if (!longPressTriggeredRef.current && !movedRef.current) onOpenMedia(post.id, mediaIndex);
    pressStartRef.current = null;
    longPressTriggeredRef.current = false;
  };

  const pointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const start = pressStartRef.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 14) {
      movedRef.current = true;
      cancelPress();
    }
  };

  const pointerCancel = () => {
    cancelPress();
    movedRef.current = true;
    pressStartRef.current = null;
    longPressTriggeredRef.current = false;
  };

  const submitComment = () => {
    const text = commentText.trim();
    if (!text) return;
    onComment(post.id, text);
    setCommentText("");
  };

  const hashtags = Array.from(post.caption.matchAll(/#[A-Za-z0-9_-]+/g)).map((match) => match[0]).slice(0, 8);
  const saveEdit = () => {
    const text = draft.trim();
    if (!text) return;
    onEdit(post.id, text);
    setEditing(false);
  };

  const toggleVideoMute = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted || video.volume === 0) {
      video.muted = false;
      video.volume = 1;
      setSoundOn(true);
      try {
        await video.play();
      } catch {
        video.muted = true;
        video.volume = 0;
        setSoundOn(false);
      }
    } else {
      video.muted = true;
      video.volume = 0;
      setSoundOn(false);
    }
  };

  const quickComments = post.commentList.slice(0, 5);
  const displayGame = post.author.game && /efootball/i.test(post.author.game) ? "Football" : post.author.game;

  return (
    <article
      id={`post-${post.id}`}
      className="matchup-feed-card relative overflow-hidden rounded-[24px] border border-[#183d67] bg-[#050f1c] shadow-[0_18px_45px_rgba(0,0,0,.24)]"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#061120] touch-pan-y select-none">
        {post.media.length ? (
          post.videoUrl ? (
            <video
              ref={videoRef}
              src={post.videoUrl}
              poster={post.media[index]}
              muted
              playsInline
              loop
              autoPlay={active}
              preload={active ? "auto" : "metadata"}
              className="absolute inset-0 size-full cursor-pointer object-cover"
              onPointerDown={pointerDown}
              onPointerUp={(event) => pointerUp(event, 0)}
              onPointerMove={pointerMove}
              onPointerCancel={pointerCancel}
              aria-label={`${post.author.name} video`}
            />
          ) : (
            post.media.map((src, mediaIndex) => (
              <img
                key={src + mediaIndex}
                src={src || "/placeholder.svg"}
                alt={`${post.author.name} post media ${mediaIndex + 1}`}
                draggable={false}
                className="absolute inset-0 size-full cursor-pointer object-cover transition-opacity duration-300"
                style={{ opacity: mediaIndex === index ? 1 : 0 }}
                onPointerDown={pointerDown}
                onPointerUp={(event) => pointerUp(event, mediaIndex)}
                onPointerMove={pointerMove}
                onPointerCancel={pointerCancel}
              />
            ))
          )
        ) : null}

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4">
          <div className="flex min-w-0 items-center gap-3 rounded-full bg-black/35 pr-3">
            <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/70 bg-[#0b3154] text-xs font-black text-white">
              {post.author.avatar ? (
                <img src={post.author.avatar} alt="" className="size-full object-cover" />
              ) : (
                post.author.initials
              )}
            </div>
            <div className="min-w-0 py-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="max-w-[180px] truncate text-sm font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.75)]">
                  {post.author.name}
                </p>
                {post.author.verified ? <MatchUpVerificationBadge /> : null}
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px] font-semibold text-white/80">
                <span>{post.time}</span>
                {displayGame ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] text-white">
                    <Gamepad2 size={10} />
                    {displayGame}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Post options"
              className="grid size-11 place-items-center rounded-full border border-white/35 bg-black/50 text-white transition hover:bg-black/65"
            >
              <MoreHorizontal size={20} />
            </button>
            {menuOpen ? (
              <div role="menu" className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-2xl border border-[#18365f] bg-[#08182b] p-1.5 shadow-xl">
                {post.isOwn ? (
                  <>
                    <button type="button" onClick={() => { setDraft(post.caption); setEditing(true); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white"><Pencil size={16} />Edit text</button>
                    <button type="button" onClick={() => { setTagOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white"><UsersRound size={16} />Tag people</button>
                    <button type="button" onClick={() => { setForwardOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white"><Forward size={16} />Forward post</button>
                    <button type="button" onClick={() => { onToggleSave(post.id); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white"><Bookmark size={16} />{post.saved ? "Unsave post" : "Save post"}</button>
                    <button type="button" onClick={() => { onDelete(post.id); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#ff9eaa]"><Trash2 size={16} />Delete post</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => { onToggleFollow(post.author.id); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white">{post.following ? "Unfollow" : "Follow"} {post.author.name}</button>
                    <button type="button" onClick={() => { onToggleSave(post.id); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white"><Bookmark size={16} />{post.saved ? "Unsave post" : "Save post"}</button>
                    <button type="button" onClick={() => { setForwardOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white"><Forward size={16} />Share / Forward</button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => onToggleLike(post.id)}
              aria-label={post.liked ? "Unlike post" : "Like post"}
              className={`grid size-12 place-items-center rounded-full border border-white/25 bg-black/55 text-white transition hover:bg-black/70 ${post.liked ? "text-[#ff4d75]" : ""}`}
            >
              <Heart size={22} fill={post.liked ? "currentColor" : "none"} />
            </button>
            <span className="mt-1 text-[11px] font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]">{formatCount(post.likes)}</span>
          </div>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => setShowComments(true)}
              aria-label="Open comments"
              className="grid size-12 place-items-center rounded-full border border-white/25 bg-black/55 text-white transition hover:bg-black/70"
            >
              <MessageCircle size={22} />
            </button>
            <span className="mt-1 text-[11px] font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]">{formatCount(post.comments)}</span>
          </div>

          <button
            type="button"
            onClick={() => setForwardOpen(true)}
            aria-label="Forward post"
            className="grid size-12 place-items-center rounded-full border border-white/25 bg-black/55 text-white transition hover:bg-black/70"
          >
            <Forward size={20} />
          </button>
        </div>

        {post.videoUrl ? (
          <>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); void toggleVideoMute(); }}
              aria-label={soundOn ? "Mute video" : "Unmute video"}
              className="absolute bottom-4 left-4 z-20 grid size-10 place-items-center rounded-full border border-white/25 bg-black/55 text-white"
            >
              {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <div className="absolute inset-x-4 bottom-4 z-20 pointer-events-none">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/30">
                <div className="h-full w-[38%] rounded-full bg-white" />
              </div>
            </div>
          </>
        ) : null}

        {post.media.length > 1 ? (
          <>
            <span className="absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white">
              {index + 1}/{post.media.length}
            </span>
            <button type="button" onClick={(event) => { event.stopPropagation(); setIndex((value) => (value - 1 + post.media.length) % post.media.length); }} aria-label="Previous media" className="absolute left-3 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); setIndex((value) => (value + 1) % post.media.length); }} aria-label="Next media" className="absolute right-20 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white">
              <ChevronRight size={18} />
            </button>
          </>
        ) : null}
      </div>

      <div className="bg-[#071426] p-4 sm:p-5" onClick={() => onOpenPost(post.id)}>
        {editing ? (
          <div onClick={(event) => event.stopPropagation()}>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} className="w-full rounded-2xl border border-[#18365f] bg-[#071426] p-3 text-sm text-white" />
            <button type="button" onClick={saveEdit} className="mt-2 rounded-full bg-[#167bd1] px-4 py-2 text-xs font-bold text-white">Save</button>
          </div>
        ) : (
          <p className="text-sm leading-6 text-[#d8e5f0]">{post.caption}</p>
        )}

        {hashtags.length ? (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold text-[#76b9ee]">
            {hashtags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        ) : null}
      </div>

      {mediaMenuOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setMediaMenuOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-[#194b7c] bg-[#08182b] p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <p className="px-3 py-2 text-xs font-black uppercase tracking-[.14em] text-[#70c1ff]">Media actions</p>
            <button type="button" onClick={() => { onToggleSave(post.id); setMediaMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left text-sm font-bold text-white"><Bookmark size={18} />{post.saved ? "Unsave" : "Save"} {post.videoUrl ? "Video" : "Image"}</button>
            <button type="button" onClick={() => { onDownload(post.id, post.videoUrl ? "video" : "image"); setMediaMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left text-sm font-bold text-white"><Download size={18} />Download {post.videoUrl ? "Video" : "Image"}</button>
            <button type="button" onClick={() => setMediaMenuOpen(false)} className="mt-1 flex w-full items-center justify-center rounded-2xl bg-[#0b3154] p-3 text-sm font-bold text-[#b7c9da]">Cancel</button>
          </div>
        </div>
      ) : null}

      {showComments ? (
        <div className="fixed inset-0 z-[110] bg-black/45 p-3 sm:p-5" role="dialog" aria-modal="true" onClick={() => setShowComments(false)}>
          <section
            className="absolute inset-x-3 bottom-3 max-h-[76vh] overflow-hidden rounded-[28px] border border-white/15 bg-[#071426]/95 shadow-2xl sm:inset-y-5 sm:left-auto sm:right-5 sm:w-[min(420px,calc(100%-2.5rem))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[#36506b] sm:hidden" />
            <div className="flex items-center justify-between border-b border-[#153c68] px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-white">Comments</h2>
                <p className="text-xs text-[#86a1bb]">{formatCount(post.comments)} comments · {post.author.name}</p>
              </div>
              <button type="button" onClick={() => setShowComments(false)} aria-label="Close comments" className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/30 text-white"><X size={18} /></button>
            </div>
            <div className="max-h-[52vh] overflow-y-auto px-5 py-3">
              {quickComments.map((comment) => (
                <div key={comment.id} className="border-b border-[#15304e] py-4">
                  <div className="flex gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0b3154] text-xs font-black text-[#70c1ff]">{comment.author.slice(0, 1).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-white">{comment.author}</p>
                      <p className="mt-1 text-sm leading-5 text-[#d8e5f0]">{comment.text}</p>
                      <div className="mt-2 flex items-center gap-4 text-[11px] font-bold text-[#7892ac]"><span>{comment.time}</span><button type="button" className="text-[#70c1ff]">Reply</button></div>
                    </div>
                  </div>
                </div>
              ))}
              {!quickComments.length ? <div className="py-12 text-center text-sm text-[#86a1bb]">No comments yet. Start the conversation.</div> : null}
              {post.comments > 5 ? <button type="button" onClick={() => onOpenPost(post.id)} className="my-3 text-sm font-black text-[#70c1ff]">View all {post.comments} comments</button> : null}
            </div>
            <div className="border-t border-[#153c68] bg-[#071b2f] p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2 rounded-2xl border border-[#18365f] bg-[#0a2139] px-3 py-2">
                <input
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") submitComment(); }}
                  placeholder="Add a comment..."
                  aria-label="Add a comment"
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-[#7892ac]"
                />
                <button type="button" aria-label="Add emoji" className="grid size-9 shrink-0 place-items-center rounded-full text-xl">😊</button>
                <button type="button" aria-label="Tag someone" className="grid size-9 shrink-0 place-items-center rounded-full text-lg font-black text-[#70c1ff]">@</button>
                <button type="button" onClick={submitComment} aria-label="Send comment" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#167bd1] text-white"><Send size={16} /></button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <ContentForwarder
        friendsOnly
        open={forwardOpen}
        onClose={() => setForwardOpen(false)}
        title={`Post by ${post.author.name}`}
        contentUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/feeds/post/${post.id}`}
      />
      <PostTagger open={tagOpen} onClose={() => setTagOpen(false)} postId={post.id} />
    </article>
  );
}
