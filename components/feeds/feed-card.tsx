"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Heart, Link2, MessageCircle, MoreHorizontal, Pencil, Play, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { formatCount, type Post } from "./data";

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
};

export function FeedCard({ post, onToggleLike, onToggleFollow, onComment, onEditComment, onDeleteComment, onShare, onDelete, onEdit }: FeedCardProps) {
  const [index, setIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.caption);
  const [commentMenu, setCommentMenu] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const commentMenuRef = useRef<HTMLDivElement | null>(null);
  const total = post.media.length;

  useEffect(() => {
    if (!menuOpen && !commentMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuOpen && menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (commentMenu && commentMenuRef.current && !commentMenuRef.current.contains(target)) setCommentMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, commentMenu]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !post.videoUrl) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        video.muted = true;
        setSoundOn(false);
        void video.play().catch(() => undefined);
      } else {
        video.pause();
        video.muted = true;
        setSoundOn(false);
      }
    }, { threshold: 0.6 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [post.videoUrl]);

  const goTo = (next: number) => setIndex((next + total) % total);
  const handlePointerDown = (e: React.PointerEvent) => setDragStartX(e.clientX);
  const handlePointerUp = (e: React.PointerEvent) => { if (dragStartX === null) return; const delta = e.clientX - dragStartX; if (Math.abs(delta) > 40) goTo(delta < 0 ? index + 1 : index - 1); setDragStartX(null); };
  const submitComment = () => { const text = commentText.trim(); if (!text) return; onComment(post.id, text); setCommentText(""); };
  const saveEdit = () => { const text = draft.trim(); if (!text) return; onEdit(post.id, text); setEditing(false); };
  const startCommentEdit = (id: string, text: string) => { setEditingComment(id); setCommentDraft(text); setCommentMenu(null); };
  const saveCommentEdit = (id: string) => { const text = commentDraft.trim(); if (!text) return; onEditComment(post.id, id, text); setEditingComment(null); setCommentDraft(""); };

  const toggleVideoMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setSoundOn(!video.muted);
    void video.play().catch(() => undefined);
  };

  const [g1, g2] = post.author.gradient;

  return (
    <article className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-xs font-black text-white" style={{ background: `linear-gradient(140deg, ${g1}, ${g2})` }} aria-hidden="true">{post.author.initials}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-bold text-white">{post.author.name}</p><p className="text-xs text-[#9694aa]">{post.time}</p></div>
        {post.isOwn ? <div className="relative" ref={menuRef}><button type="button" onClick={() => setMenuOpen((o) => !o)} aria-label="Post options" className="grid size-9 place-items-center rounded-full text-[#c5c3d4] transition hover:bg-[#181a30] hover:text-white"><MoreHorizontal size={20} /></button>{menuOpen ? <div role="menu" className="absolute right-0 top-11 z-30 w-40 overflow-hidden rounded-2xl border border-[#26263d] bg-[#0d0e20] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,.5)]"><button type="button" role="menuitem" onClick={() => { setDraft(post.caption); setEditing(true); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#dcdae8] hover:bg-[#181a30]"><Pencil size={16} />Edit text</button><button type="button" role="menuitem" onClick={() => { onDelete(post.id); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#ff6b81] hover:bg-[#181a30]"><Trash2 size={16} />Delete post</button></div> : null}</div> : <button type="button" onClick={() => onToggleFollow(post.id)} aria-pressed={post.following} className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${post.following ? "border border-[#35334e] bg-transparent text-[#c5c3d4] hover:border-[#7843ee]" : "bg-[#6d27ff] text-white shadow-[0_0_18px_rgba(109,39,255,.4)] hover:brightness-110"}`}>{post.following ? "Following" : "Follow"}</button>}
      </div>

      <div className="relative aspect-[4/3] w-full touch-pan-y select-none overflow-hidden bg-[#111223]" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        {post.videoUrl ? <>
          <video ref={videoRef} src={post.videoUrl} poster={post.media[index]} muted playsInline loop autoPlay preload="auto" className="absolute inset-0 size-full object-cover" aria-label={`${post.author.name} video`} />
          <button type="button" onClick={toggleVideoMute} aria-label={soundOn ? "Mute video" : "Unmute video"} className="absolute bottom-3 right-3 z-10 grid size-10 place-items-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-sm">{soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        </> : post.media.map((src, i) => <img key={src + i} src={src || "/placeholder.svg"} alt={`${post.author.name} post media ${i + 1}`} draggable={false} crossOrigin="anonymous" className="absolute inset-0 size-full object-cover transition-opacity duration-300" style={{ opacity: i === index ? 1 : 0 }} />)}

        {post.hasVideo && !post.videoUrl ? <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-[#13132b] bg-[linear-gradient(145deg,#8e3cff,#5e1be4)] text-white shadow-[0_0_24px_rgba(122,43,255,.65)]"><Play size={24} className="ml-0.5" fill="currentColor" /></span> : null}
        {total > 1 ? <><span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white">{index + 1}/{total}</span><button type="button" onClick={() => goTo(index - 1)} aria-label="Previous media" className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white hover:bg-black/65"><ChevronLeft size={18} /></button><button type="button" onClick={() => goTo(index + 1)} aria-label="Next media" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white hover:bg-black/65"><ChevronRight size={18} /></button><div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">{post.media.map((src, i) => <button key={src + i} type="button" onClick={() => setIndex(i)} aria-label={`Go to media ${i + 1}`} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />)}</div></> : null}
      </div>

      <div className="p-4">
        {editing ? <div className="space-y-2"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus rows={3} className="w-full resize-none rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3 text-sm text-white outline-none focus:border-[#7843ee]" /><div className="flex items-center gap-2"><button type="button" onClick={saveEdit} className="flex items-center gap-1.5 rounded-full bg-[#6d27ff] px-4 py-2 text-xs font-bold text-white"><Check size={15} />Save</button><button type="button" onClick={() => setEditing(false)} className="rounded-full border border-[#35334e] px-4 py-2 text-xs font-bold text-[#c5c3d4]">Cancel</button></div></div> : <p className="text-sm leading-6 text-[#e7e5f2]">{post.caption}</p>}
        <div className="mt-4 flex items-center gap-6 text-sm font-semibold"><button type="button" onClick={() => onToggleLike(post.id)} aria-pressed={post.liked} className={`flex items-center gap-2 transition ${post.liked ? "text-[#ff4d6d]" : "text-[#c5c3d4] hover:text-white"}`}><Heart size={20} fill={post.liked ? "currentColor" : "none"} />{formatCount(post.likes)}</button><button type="button" onClick={() => setShowComments((s) => !s)} aria-expanded={showComments} className={`flex items-center gap-2 transition ${showComments ? "text-white" : "text-[#c5c3d4] hover:text-white"}`}><MessageCircle size={20} />{formatCount(post.comments)}</button><button type="button" onClick={() => onShare(post.id)} className="flex items-center gap-2 text-[#c5c3d4] hover:text-white"><Link2 size={19} />{formatCount(post.shares)}</button></div>

        {showComments ? <div className="mt-4 border-t border-[#22233a] pt-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold text-white">Comments</p><button type="button" onClick={() => setShowComments(false)} aria-label="Close comments" className="grid size-7 place-items-center rounded-full text-[#6f6d83] hover:text-white"><X size={16} /></button></div>{post.commentList.length > 0 ? <ul className="space-y-3">{post.commentList.map((c) => <li key={c.id} className="flex gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1a1b33] text-[10px] font-black text-[#b9b6cf]">{c.author.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1 rounded-2xl bg-[#12132599] px-3 py-2"><div className="flex items-center gap-2"><p className="truncate text-xs font-bold text-white">{c.author}</p><span className="shrink-0 text-[10px] text-[#6f6d83]">{c.time}</span>{c.isOwn ? <div className="relative ml-auto" ref={commentMenu === c.id ? commentMenuRef : undefined}><button type="button" onClick={() => setCommentMenu((id) => id === c.id ? null : c.id)} aria-label="Comment options" className="grid size-7 place-items-center rounded-full text-[#77758b] hover:bg-[#1b1c32] hover:text-white"><MoreHorizontal size={16} /></button>{commentMenu === c.id ? <div role="menu" className="absolute right-0 top-8 z-40 w-36 overflow-hidden rounded-xl border border-[#26263d] bg-[#0d0e20] p-1 shadow-[0_15px_35px_rgba(0,0,0,.5)]"><button type="button" onClick={() => startCommentEdit(c.id, c.text)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#dcdae8] hover:bg-[#181a30]"><Pencil size={14} />Edit text</button><button type="button" onClick={() => { onDeleteComment(post.id, c.id); setCommentMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#ff6b81] hover:bg-[#181a30]"><Trash2 size={14} />Delete</button></div> : null}</div> : null}</div>{editingComment === c.id ? <div className="mt-1.5 flex gap-2"><input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveCommentEdit(c.id); }} className="min-w-0 flex-1 rounded-full border border-[#7843ee] bg-[#0d0e20] px-3 py-1.5 text-sm text-white outline-none" /><button type="button" onClick={() => saveCommentEdit(c.id)} className="grid size-8 shrink-0 place-items-center rounded-full bg-[#6d27ff] text-white"><Check size={15} /></button></div> : <p className="mt-0.5 break-words text-sm text-[#dcdae8]">{c.text}</p>}</div></li>)}</ul> : <p className="text-sm text-[#6f6d83]">Be the first to comment.</p>}<div className="mt-3 flex items-center gap-2"><input value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submitComment(); }} placeholder="Add a comment..." className="flex-1 rounded-full border border-[#26263d] bg-[#0d0e20] px-4 py-2 text-sm text-white outline-none placeholder:text-[#6f6d83] focus:border-[#7843ee]" /><button type="button" onClick={submitComment} aria-label="Post comment" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#6d27ff] text-white hover:brightness-110"><Link2 size={16} /></button></div></div> : null}
      </div>
    </article>
  );
}
