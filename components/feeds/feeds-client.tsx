"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bookmark,
  LogOut,
  Search,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { CreateHub } from "./create-hub";
import { FeedCard } from "./feed-card";
import { initialPosts, type FeedAction, type FeedTab, type Post } from "./data";

const tabs: { id: FeedTab; label: string }[] = [
  { id: "for-you", label: "For You" },
  { id: "following", label: "Following" },
];

const menuItems = [
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "saved", label: "Saved posts", icon: Bookmark },
  { id: "profile", label: "Your profile", icon: UserRound },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "logout", label: "Log out", icon: LogOut },
];

export function FeedsClient() {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [tab, setTab] = useState<FeedTab>("for-you");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [composer, setComposer] = useState<FeedAction | null>(null);
  const [composerText, setComposerText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

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
      return (
        post.author.name.toLowerCase().includes(q) ||
        post.author.handle.toLowerCase().includes(q) ||
        post.caption.toLowerCase().includes(q)
      );
    });
  }, [posts, tab, query]);

  const toggleLike = (id: string) =>
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }
          : p,
      ),
    );

  const toggleFollow = (id: string) =>
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, following: !p.following } : p)),
    );

  const addComment = (id: string, text: string) =>
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              comments: p.comments + 1,
              commentList: [
                ...p.commentList,
                {
                  id: `c-${Date.now()}`,
                  author: "You",
                  text,
                  time: "Just now",
                },
              ],
            }
          : p,
      ),
    );

  const deletePost = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setToast("Post deleted");
  };

  const editPost = (id: string, caption: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
    setToast("Post updated");
  };

  const share = (id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, shares: p.shares + 1 } : p)),
    );
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
      author: {
        name: "You",
        handle: "@you",
        gradient: ["#8e3cff", "#5e1be4"],
        initials: "ME",
      },
      time: "Just now",
      caption: text,
      media: ["https://images.pexels.com/photos/36247048/pexels-photo-36247048.jpeg?auto=compress&cs=tinysrgb&w=1000"],
      hasVideo: composer.id === "upload-gameplay" || composer.id === "goal-highlight",
      likes: 0,
      comments: 0,
      commentList: [],
      shares: 0,
      liked: false,
      following: true,
      isOwn: true,
      category: "community",
    };
    setPosts((prev) => [newPost, ...prev]);
    setComposer(null);
    setComposerText("");
    setToast(`${composer.title} shared to your feed`);
  };

  return (
    <>
      <header className="relative z-20 flex items-start justify-between pb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">Feed</h1>
          <p className="mt-1 text-sm text-[#9694aa]">Connect. Compete. Grow.</p>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="relative grid size-11 place-items-center rounded-2xl border border-[#26263d] bg-[#0d0e20] text-[#eeeef7] transition hover:border-[#7843ee]"
          >
            <Bell size={19} />
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-[#7634ef]" />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[52px] z-40 w-52 overflow-hidden rounded-2xl border border-[#26263d] bg-[#0d0e20] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,.5)]"
            >
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setToast(`Opened ${item.label}`);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-[#181a30] ${
                      item.id === "logout" ? "text-[#ff6b81]" : "text-[#dcdae8]"
                    }`}
                  >
                    <Icon size={17} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t.id
                ? "bg-white text-[#0b0c18]"
                : "border border-[#26263d] bg-[#0d0e20] text-[#c5c3d4] hover:border-[#7843ee]"
            }`}
          >
            {t.label}
          </button>
        ))}
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[#26263d] bg-[#0d0e20] px-3.5 py-2 focus-within:border-[#7843ee]">
          <Search size={17} className="shrink-0 text-[#6f6d83]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts or players"
            aria-label="Search feed"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6f6d83]"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={16} className="text-[#6f6d83] hover:text-white" />
            </button>
          ) : null}
        </label>
      </div>

      <CreateHub onAction={openComposer} />

      <section className="mt-5 space-y-4">
        {visiblePosts.length === 0 ? (
          <div className="surface-card p-8 text-center">
            <p className="font-bold text-white">No posts found</p>
            <p className="mt-1 text-sm text-[#9694aa]">
              {tab === "following"
                ? "Follow players to see their posts here."
                : "Try a different search."}
            </p>
          </div>
        ) : (
          visiblePosts.map((post) => (
            <FeedCard
              key={post.id}
              post={post}
              onToggleLike={toggleLike}
              onToggleFollow={toggleFollow}
              onComment={addComment}
              onShare={share}
              onDelete={deletePost}
              onEdit={editPost}
            />
          ))
        )}
      </section>

      {composer ? (
        <div
          className="install-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setComposer(null);
          }}
        >
          <div className="install-sheet">
            <button
              type="button"
              onClick={() => setComposer(null)}
              aria-label="Close"
              className="install-close"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <span className={`grid size-11 place-items-center rounded-2xl ${composer.tile}`}>
                <composer.icon size={22} />
              </span>
              <div>
                <h3 className="text-lg font-black text-white">{composer.title}</h3>
                <p className="text-xs text-[#9694aa]">{composer.subtitle}</p>
              </div>
            </div>
            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              autoFocus
              rows={4}
              placeholder="What do you want to share?"
              className="mt-4 w-full resize-none rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3.5 text-sm text-white outline-none placeholder:text-[#6f6d83] focus:border-[#7843ee]"
            />
            <div className="install-actions">
              <button type="button" onClick={submitComposer} className="install-btn-primary">
                Share to feed
              </button>
              <button
                type="button"
                onClick={() => setComposer(null)}
                className="install-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#35334e] bg-[#14152a] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.5)]">
          {toast}
        </div>
      ) : null}
    </>
  );
}
