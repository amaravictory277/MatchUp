"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Download,
  Forward,
  Gamepad2,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
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

function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function FeedCard({
  post,
  onToggleLike,
  onToggleFollow,
  onComment,
  onEditComment: _onEditComment,
  onDeleteComment: _onDeleteComment,
  onShare: _onShare,
  onDelete,
  onEdit,
  onToggleSave,
  onDownload,
  onOpenPost,
  onOpenMedia,
  onLongPressVideo: _onLongPressVideo,
  commentRequest = 0,
  active = true,
}: FeedCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.caption);
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lastCommentRequestRef = useRef(commentRequest);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  const movedRef = useRef(false);

  useEffect(() => {
    setDraft(post.caption);
    setShowComments(false);
    setMenuOpen(false);
    setMediaMenuOpen(false);
    setForwardOpen(false);
    setTagOpen(false);
    setEditing(false);
    setPlaying(false);
    setSoundOn(false);
    setVideoProgress(0);
    setVideoDuration(0);
  }, [post.id, post.caption]);

  useEffect(() => {
    if (commentRequest !== lastCommentRequestRef.current) {
      lastCommentRequestRef.current = commentRequest;
      if (commentRequest > 0) setShowComments(true);
    }
  }, [commentRequest]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !post.videoUrl) return;

    if (!active) {
      video.pause();
      setPlaying(false);
      return;
    }

    video.muted = true;
    video.volume = 0;
    void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          video.pause();
          setPlaying(false);
        } else {
          void video.play().then(() => setPlaying(true)).catch(() => undefined);
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

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

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

  const pointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const start = pressStartRef.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 14) {
      movedRef.current = true;
      cancelPress();
    }
  };

  const pointerUp = (event: React.PointerEvent<HTMLElement>, mediaIndex: number) => {
    cancelPress();
    if (!longPressTriggeredRef.current && !movedRef.current) onOpenMedia(post.id, mediaIndex);
    pressStartRef.current = null;
    longPressTriggeredRef.current = false;
  };

  const pointerCancel = () => {
    cancelPress();
    movedRef.current = true;
    pressStartRef.current = null;
    longPressTriggeredRef.current = false;
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setPlaying(true)).catch(() => undefined);
    } else {
      video.pause();
      setPlaying(false);
    }
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
        setPlaying(true);
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

  const submitComment = () => {
    const text = commentText.trim();
    if (!text) return;
    onComment(post.id, text);
    setCommentText("");
  };

  const saveEdit = () => {
    const text = draft.trim();
    if (!text) return;
    onEdit(post.id, text);
    setEditing(false);
  };

  const displayGame = post.author.game && /efootball/i.test(post.author.game) ? "Football" : post.author.game;
  const quickComments = post.commentList.slice(0, 5);

  return (
    <article
      id={`post-${post.id}`}
      className="matchup-feed-card relative aspect-[3/2] w-full overflow-hidden rounded-[24px] border border-white/20 bg-[#07111d] text-white"
      onContextMenu={(event) => event.preventDefault()}
    >
      {post.media.length ? (
        post.videoUrl ? (
          <video
            ref={videoRef}
            src={post.videoUrl}
            poster={post.media[0]}
            muted
            playsInline
            loop
            autoPlay={active}
            preload={active ? "auto" : "metadata"}
            className="absolute inset-0 size-full object-cover"
            onLoadedMetadata={(event) => setVideoDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
            onTimeUpdate={(event) => {
              const duration = event.currentTarget.duration;
              setVideoProgress(duration > 0 ? event.currentTarget.currentTime / duration : 0);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
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
              className="absolute inset-0 size-full object-cover"
              style={{ opacity: mediaIndex === 0 ? 1 : 0 }}
              onPointerDown={pointerDown}
              onPointerUp={(event) => pointerUp(event, mediaIndex)}
              onPointerMove={pointerMove}
              onPointerCancel={pointerCancel}
            />
          ))
        )
      ) : (
        <div className="absolute inset-0 bg-[#071426]" />
      )}

      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/35 via-transparent to-black/45 pointer-events-none" />

      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-5 sm:p-7">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/80 bg-[#0b3154] text-sm font-black text-white shadow-[0_4px_14px_rgba(0,0,0,.3)] sm:size-20 sm:border-[3px]">
              {post.author.avatar ? (
                <img src={post.author.avatar} alt="" className="size-full object-cover" />
              ) : (
                post.author.initials
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-lg font-black leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,.8)] sm:text-[30px]">
                  {post.author.name}
                </p>
                {post.author.verified ? <MatchUpVerificationBadge /> : null}
              </div>
              {displayGame ? (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#21344d]/95 px-3 py-1.5 text-[11px] font-semibold text-white sm:text-[17px]">
                  <Gamepad2 size={13} className="sm:size-[18px]" />
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
            className="grid size-12 place-items-center rounded-full border border-white/35 bg-black/35 text-white sm:size-[78px] sm:border-2"
          >
            <MoreHorizontal size={23} className="sm:size-[32px]" />
          </button>
          {menuOpen ? (
            <div role="menu" className="absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-2xl border border-[#18365f] bg-[#08182b] p-1.5 shadow-xl sm:top-20">
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

      {post.videoUrl ? (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); togglePlay(); }}
          aria-label={playing ? "Pause video" : "Play video"}
          className="absolute left-1/2 top-1/2 z-20 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/35 text-white shadow-[0_8px_25px_rgba(0,0,0,.3)] sm:size-40"
        >
          {playing ? <Pause size={45} fill="currentColor" className="sm:size-[64px]" /> : <Play size={48} fill="currentColor" className="ml-1 sm:size-[68px]" />}
        </button>
      ) : null}

      <div className="absolute right-5 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-4 sm:right-7 sm:gap-6">
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onToggleLike(post.id); }}
            aria-label={post.liked ? "Unlike post" : "Like post"}
            className="grid size-14 place-items-center rounded-[22px] border border-white/10 bg-black/55 text-white shadow-[0_5px_18px_rgba(0,0,0,.28)] sm:size-[92px] sm:rounded-[28px]"
          >
            <Heart size={29} fill={post.liked ? "currentColor" : "none"} className={post.liked ? "text-[#ff445d]" : ""} />
          </button>
          <span className="mt-1.5 text-sm font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,.9)] sm:text-[20px]">{formatCount(post.likes)}</span>
        </div>

        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); setShowComments(true); }}
            aria-label="Open comments"
            className="grid size-14 place-items-center rounded-[22px] border border-white/10 bg-black/55 text-white shadow-[0_5px_18px_rgba(0,0,0,.28)] sm:size-[92px] sm:rounded-[28px]"
          >
            <MessageCircle size={30} />
          </button>
          <span className="mt-1.5 text-sm font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,.9)] sm:text-[20px]">{formatCount(post.comments)}</span>
        </div>
      </div>

      {post.videoUrl ? (
        <>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); void toggleVideoMute(); }}
            aria-label={soundOn ? "Mute video" : "Unmute video"}
            className="absolute bottom-14 left-5 z-30 grid size-12 place-items-center rounded-full border border-white/15 bg-black/55 text-white sm:bottom-16 sm:left-7 sm:size-[62px]"
          >
            {soundOn ? <Volume2 size={21} /> : <VolumeX size={21} />}
          </button>
          <div className="absolute inset-x-5 bottom-5 z-30 sm:inset-x-7 sm:bottom-7">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,.9)] sm:text-[20px]">
              <span className="shrink-0">{formatVideoTime(videoProgress * videoDuration)} / {formatVideoTime(videoDuration)}</span>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/40 sm:h-3">
                <div className="h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${Math.max(0, Math.min(1, videoProgress)) * 100}%` }} />
              </div>
            </div>
          </div>
        </>
      ) : null}

      {post.caption ? (
        <div className="absolute bottom-16 left-5 z-25 max-w-[58%] sm:bottom-20 sm:left-7">
          <div className="relative inline-flex max-w-full items-center gap-2 rounded-full bg-[#071426]/95 px-4 py-2.5 pr-6 shadow-[0_5px_18px_rgba(0,0,0,.28)]">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f5c32c] text-lg text-[#071426]">🔥</span>
            <span className="truncate text-sm font-black text-white sm:text-[20px]">{post.caption}</span>
          </div>
        </div>
      ) : null}

      {post.media.length > 1 ? (
        <div className="absolute left-1/2 top-28 z-30 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-white">
          {1}/{post.media.length}
        </div>
      ) : null}

      {editing ? (
        <div className="absolute inset-0 z-[60] grid place-items-center bg-black/70 p-5" onClick={() => setEditing(false)}>
          <div className="w-full max-w-md rounded-3xl bg-[#071426] p-5" onClick={(event) => event.stopPropagation()}>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} className="w-full rounded-2xl border border-[#18365f] bg-[#0a2139] p-3 text-sm text-white" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-[#214a78] px-4 py-2 text-sm font-bold text-[#b7c9da]">Cancel</button>
              <button type="button" onClick={saveEdit} className="rounded-xl bg-[#167bd1] px-4 py-2 text-sm font-bold text-white">Save</button>
            </div>
          </div>
        </div>
      ) : null}

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
          <section className="absolute inset-x-3 bottom-3 max-h-[76vh] overflow-hidden rounded-[28px] border border-white/15 bg-[#071426]/95 shadow-2xl sm:inset-y-5 sm:left-auto sm:right-5 sm:w-[min(420px,calc(100%-2.5rem))]" onClick={(event) => event.stopPropagation()}>
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
                <input value={commentText} onChange={(event) => setCommentText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitComment(); }} placeholder="Add a comment..." aria-label="Add a comment" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-[#7892ac]" />
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
