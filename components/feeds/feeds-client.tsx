"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Search, X } from "lucide-react";
import { CreateHub } from "./create-hub";
import { FeedCard } from "./feed-card";
import { initialPosts, playInteractionSound, type FeedAction, type FeedTab, type Post } from "./data";
import { recordLocalNotification } from "../../lib/notifications/local";

const tabs: { id: FeedTab; label: string }[] = [
  { id: "for-you", label: "For You" },
  { id: "following", label: "Following" },
];

const FEED_STORAGE_KEY = "matchup.feed.state.v1";

function readPersistedPosts(): Post[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FEED_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Post[];
  } catch {
    return null;
  }
}

function persistPosts(posts: Post[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(posts));
  } catch {
    // Storage may be unavailable; the feed still works for the current session.
  }
}

export function FeedsClient() {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<FeedTab>("for-you");
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState<FeedAction | null>(null);
  const [composerText, setComposerText] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const saved = readPersistedPosts();
    if (saved) setPosts(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) persistPosts(posts);
  }, [posts, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const visiblePosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (tab === "following" && !post.following) return false;
      if (!q) return true;
      return post.author.name.toLowerCase().includes(q) || post.author.handle.toLowerCase().includes(q) || post.caption.toLowerCase().includes(q);
    });
  }, [posts, tab, query]);

  const toggleLike = (id: string) => {
    setPosts((prev) => {
      const post = prev.find((item) => item.id === id);
      if (!post) return prev;
      const nextLiked = !post.liked;
      if (nextLiked) {
        recordLocalNotification({
          kind: post.isOwn ? "post_like_received" : "post_liked",
          message: post.isOwn ? "Someone liked your post" : `You liked ${post.author.name}'s post`,
          actorName: post.isOwn ? "MatchUp player" : "You",
          entityType: "post",
          entityId: post.id,
          href: `/feeds?post=${post.id}`,
          thumbnail: post.media[0],
        });
      }
      return prev.map((p) => p.id === id ? { ...p, liked: nextLiked, likes: p.likes + (p.liked ? -1 : 1) } : p);
    });
  };

  const toggleFollow = (id: string) => {
    setPosts((prev) => {
      const post = prev.find((item) => item.id === id);
      if (!post) return prev;
      if (!post.following) {
        recordLocalNotification({
          kind: "person_followed",
          message: `You followed ${post.author.name}`,
          actorName: "You",
          entityType: "profile",
          entityId: post.id,
          href: "/feeds#profile",
        });
      }
      return prev.map((p) => p.id === id ? { ...p, following: !p.following } : p);
    });
    playInteractionSound("follow");
  };

  const addComment = (id: string, text: string) => {
    setPosts((prev) => {
      const post = prev.find((item) => item.id === id);
      if (!post) return prev;
      recordLocalNotification({
        kind: "post_comment",
        message: post.isOwn ? "Someone commented on your post" : `You commented on ${post.author.name}'s post`,
        actorName: post.isOwn ? "MatchUp player" : "You",
        entityType: "post",
        entityId: post.id,
        href: `/feeds?post=${post.id}`,
        thumbnail: post.media[0],
        meta: { comment_text: text },
      });
      if (/@[a-zA-Z0-9_]{2,24}/.test(text)) {
        recordLocalNotification({
          kind: "comment_tagged",
          message: "You were tagged in a comment",
          actorName: "You",
          entityType: "post",
          entityId: post.id,
          href: `/feeds?post=${post.id}`,
          thumbnail: post.media[0],
        });
      }
      return prev.map((p) => p.id === id ? {
        ...p,
        comments: p.comments + 1,
        commentList: [...p.commentList, { id: `c-${Date.now()}`, author: "You", text, time: "Just now", isOwn: true }],
      } : p);
    });
    playInteractionSound("comment");
  };

  const editComment = (postId: string, commentId: string, text: string) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, commentList: p.commentList.map((c) => c.id === commentId ? { ...c, text } : c) } : p));
    setToast("Comment updated");
  };

  const deleteComment = (postId: string, commentId: string) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: Math.max(0, p.comments - 1), commentList: p.commentList.filter((c) => c.id !== commentId) } : p));
    setToast("Comment deleted");
  };

  const deletePost = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setToast("Post deleted");
  };

  const editPost = (id: string, caption: string) => {
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, caption } : p));
    setToast("Post updated");
  };

  const share = (id: string) => {
    setPosts((prev) => {
      const post = prev.find((item) => item.id === id);
      if (post) {
        recordLocalNotification({
          kind: "post_link_copied",
          message: "You copied a post link",
          actorName: "You",
          entityType: "post",
          entityId: post.id,
          href: `/feeds?post=${post.id}`,
          thumbnail: post.media[0],
        });
      }
      return prev.map((p) => p.id === id ? { ...p, shares: p.shares + 1 } : p);
    });
    setToast("Link copied — post shared");
  };

  const openComposer = (action: FeedAction) => {
    if (action.id === "follow-players") {
      setTab("following");
      setToast("Discover players to follow below");
      return;
    }
    setComposer(action);
    setComposerText("");
  };

  const submitComposer = () => {
    if (!composer) return;
    const text = composerText.trim();
    if (!text) {
      setComposer(null);
      return;
    }
    const newPost: Post = {
      id: `p-${Date.now()}`,
      author: { name: "You", handle: "@you", gradient: ["#8e3cff", "#5e1be4"], initials: "ME" },
      time: "Just now",
      caption: text,
      media: ["https://images.pexels.com/photos/36247048/pexels-photo-36247048.jpeg?auto=compress&cs=tinysrgb&w=1000"],
      hasVideo: composer.id === "upload-gameplay" || composer.id === "goal-highlight",
      likes: 0, comments: 0, commentList: [], shares: 0, liked: false, following: true, isOwn: true, category: "community",
    };
    setPosts((prev) => [newPost, ...prev]);
    recordLocalNotification({
      kind: "post_created",
      message: "You made a new post",
      actorName: "You",
      entityType: "post",
      entityId: newPost.id,
      href: `/feeds?post=${newPost.id}`,
      thumbnail: newPost.media[0],
    });
    if (/@[a-zA-Z0-9_]{2,24}/.test(text)) {
      recordLocalNotification({
        kind: "post_tagged",
        message: "You tagged someone in your post",
        actorName: "You",
        entityType: "post",
        entityId: newPost.id,
        href: `/feeds?post=${newPost.id}`,
        thumbnail: newPost.media[0],
      });
    }
    setComposer(null);
    setComposerText("");
    setToast(`${composer.title} shared to your feed`);
    playInteractionSound("post");
  };

  return (
    <>
      <header className="relative z-20 flex items-start justify-between pb-4">
        <div><h1 className="text-4xl font-black tracking-tight text-white">Feed</h1><p className="mt-1 text-sm text-[#9694aa]">Connect. Compete. Grow.</p></div>
        <button type="button" onClick={() => { window.location.href = "/notifications"; }} aria-label="Open notifications" className="relative grid size-11 place-items-center rounded-2xl border border-[#26263d] bg-[#0d0e20] text-[#eeeef7] transition hover:border-[#7843ee]"><Bell size={19} /><span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-[#7634ef]" /></button>
      </header>

      <div className="flex items-center gap-2">
        {tabs.map((t) => <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-pressed={tab === t.id} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${tab === t.id ? "bg-white text-[#0b0c18]" : "border border-[#26263d] bg-[#0d0e20] text-[#c5c3d4] hover:border-[#7843ee]"}`}>{t.label}</button>)}
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[#26263d] bg-[#0d0e20] px-3.5 py-2 focus-within:border-[#7843ee]"><Search size={17} className="shrink-0 text-[#6f6d83]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search posts or players" aria-label="Search feed" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6f6d83]" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} className="text-[#6f6d83] hover:text-white" /></button> : null}</label>
      </div>

      <CreateHub onAction={openComposer} />

      <section className="mt-5 space-y-4">
        {visiblePosts.length === 0 ? <div className="surface-card p-8 text-center"><p className="font-bold text-white">No posts found</p><p className="mt-1 text-sm text-[#9694aa]">{tab === "following" ? "Follow players to see their posts here." : "Try a different search."}</p></div> : visiblePosts.map((post) => <FeedCard key={post.id} post={post} onToggleLike={toggleLike} onToggleFollow={toggleFollow} onComment={addComment} onEditComment={editComment} onDeleteComment={deleteComment} onShare={share} onDelete={deletePost} onEdit={editPost} />)}
      </section>

      {composer ? <div className="install-overlay" onClick={(e) => { if (e.target === e.currentTarget) setComposer(null); }}><div className="install-sheet">
        <button type="button" onClick={() => setComposer(null)} aria-label="Close" className="install-close"><X size={18} /></button>
        <div className="flex items-center gap-3"><span className={`grid size-11 place-items-center rounded-2xl ${composer.tile}`}><composer.icon size={22} /></span><div><h3 className="text-lg font-black text-white">{composer.title}</h3><p className="text-xs text-[#9694aa]">{composer.subtitle}</p></div></div>
        <textarea value={composerText} onChange={(e) => setComposerText(e.target.value)} autoFocus rows={4} placeholder="What do you want to share?" className="mt-4 w-full resize-none rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3.5 text-sm text-white outline-none placeholder:text-[#6f6d83]" />
        <div className="install-actions"><button type="button" onClick={submitComposer} className="install-btn-primary">Share to feed</button><button type="button" onClick={() => setComposer(null)} className="install-btn-secondary">Cancel</button></div>
      </div></div> : null}

      {toast ? <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#35334e] bg-[#14152a] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.5)]">{toast}</div> : null}
    </>
  );
}
