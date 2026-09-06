import { Camera, MessageSquareText, Trophy, UserPlus, Video, type LucideIcon } from "lucide-react";
export type FeedTab = "for-you" | "following";
export type Author = { name: string; handle: string; gradient: [string, string]; initials: string };
export type Comment = { id: string; author: string; text: string; time: string; isOwn?: boolean };
export type Post = { id: string; author: Author; time: string; caption: string; media: string[]; hasVideo: boolean; likes: number; comments: number; commentList: Comment[]; shares: number; liked: boolean; following: boolean; isOwn?: boolean; category: "sports" | "community" };
export type FeedAction = { id: string; title: string; subtitle: string; icon: LucideIcon; tile: string };
export const feedActions: FeedAction[] = [
  { id: "post-squad", title: "Post a squad", subtitle: "Show your team.", icon: Camera, tile: "bg-[#25134e] text-[#a979ff]" },
  { id: "upload-gameplay", title: "Upload gameplay", subtitle: "Share your matches.", icon: Video, tile: "bg-[#0f3a2c] text-[#3fd39a]" },
  { id: "tournament-win", title: "Share a tournament win", subtitle: "Celebrate your victory.", icon: Trophy, tile: "bg-[#3a2e0b] text-[#e6c34d]" },
  { id: "goal-highlight", title: "Share a goal/highlight", subtitle: "Show the best moments.", icon: Trophy, tile: "bg-[#0e2a4e] text-[#4d8bff]" },
  { id: "normal-post", title: "Make a normal post", subtitle: "Talk. Share. Connect.", icon: MessageSquareText, tile: "bg-[#25134e] text-[#c77bff]" },
  { id: "follow-players", title: "Follow/add other players", subtitle: "Grow your network.", icon: UserPlus, tile: "bg-[#0e2a4e] text-[#4d8bff]" },
];
export function playInteractionSound(kind: "follow" | "comment" | "post") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass(); const now = context.currentTime;
    const gain = context.createGain(); const oscillator = context.createOscillator();
    const pitch = kind === "follow" ? 660 : kind === "comment" ? 740 : 590;
    oscillator.type = "sine"; oscillator.frequency.setValueAtTime(pitch, now); oscillator.frequency.exponentialRampToValueAtTime(pitch * 1.16, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.045, now + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(now); oscillator.stop(now + 0.12); oscillator.addEventListener("ended", () => void context.close());
  } catch { /* Optional enhancement; do not block the action. */ }
}
export const initialPosts: Post[] = [
  { id: "p1", author: { name: "Daniel Taylor", handle: "@dant", gradient: ["#8e3cff", "#5e1be4"], initials: "DT" }, time: "3 min ago", caption: "Best moment from last night's match! What a game! 🔥⚽", media: ["https://images.pexels.com/photos/27348425/pexels-photo-27348425.jpeg?auto=compress&cs=tinysrgb&w=1000", "https://images.pexels.com/photos/36000773/pexels-photo-36000773.jpeg?auto=compress&cs=tinysrgb&w=1000", "https://images.pexels.com/photos/7005503/pexels-photo-7005503.jpeg?auto=compress&cs=tinysrgb&w=1000"], hasVideo: true, likes: 1200, comments: 3, commentList: [{ id: "c1", author: "Amara Okafor", text: "Unreal finish!", time: "2 min ago" }, { id: "c2", author: "Kelvin Mensah", text: "Been watching this on repeat 🔁", time: "1 min ago" }, { id: "c3", author: "Sofia Reyes", text: "Squad looking sharp this season.", time: "just now" }], shares: 70, liked: false, following: false, category: "sports" },
  { id: "p2", author: { name: "Amara Okafor", handle: "@amara", gradient: ["#3fd39a", "#12604a"], initials: "AO" }, time: "18 min ago", caption: "New squad locked in for the Champions Cup. Who's ready to run it back?", media: ["https://images.pexels.com/photos/36247048/pexels-photo-36247048.jpeg?auto=compress&cs=tinysrgb&w=1000", "https://images.pexels.com/photos/36000773/pexels-photo-36000773.jpeg?auto=compress&cs=tinysrgb&w=1000"], hasVideo: false, likes: 842, comments: 2, commentList: [{ id: "c4", author: "Daniel Taylor", text: "Count me in for the Cup!", time: "10 min ago" }, { id: "c5", author: "Sofia Reyes", text: "Let's run it back 💪", time: "5 min ago" }], shares: 34, liked: true, following: true, category: "community" },
  { id: "p3", author: { name: "Kelvin Mensah", handle: "@kelv", gradient: ["#4d8bff", "#1b2e6e"], initials: "KM" }, time: "1 hr ago", caption: "Clutch goal to win the weekend clash. Prize secured! 🏆", media: ["https://images.pexels.com/photos/7005503/pexels-photo-7005503.jpeg?auto=compress&cs=tinysrgb&w=1000"], hasVideo: true, likes: 3100, comments: 1, commentList: [{ id: "c6", author: "Amara Okafor", text: "Clutch! Congrats on the win 🏆", time: "40 min ago" }], shares: 220, liked: false, following: true, category: "sports" },
  { id: "p4", author: { name: "Sofia Reyes", handle: "@sofir", gradient: ["#e6c34d", "#6b4e0b"], initials: "SR" }, time: "2 hr ago", caption: "Highlight reel from the group stage. Rate the finish out of 10 👇", media: ["https://images.pexels.com/photos/36000773/pexels-photo-36000773.jpeg?auto=compress&cs=tinysrgb&w=1000", "https://images.pexels.com/photos/27348425/pexels-photo-27348425.jpeg?auto=compress&cs=tinysrgb&w=1000", "https://images.pexels.com/photos/36247048/pexels-photo-36247048.jpeg?auto=compress&cs=tinysrgb&w=1000"], hasVideo: true, likes: 560, comments: 2, commentList: [{ id: "c7", author: "Kelvin Mensah", text: "Solid 9/10 from me.", time: "1 hr ago" }, { id: "c8", author: "Daniel Taylor", text: "That first touch though 👀", time: "50 min ago" }], shares: 12, liked: false, following: false, category: "sports" },
];
export function formatCount(value: number): string { if (value >= 1000) { const rounded = value / 1000; return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}k`; } return `${value}`; }
