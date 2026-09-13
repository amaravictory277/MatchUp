import fs from "node:fs";

const path = "components/chat/chat-hub.tsx";
let source = fs.readFileSync(path, "utf8");

if (!source.includes("SidebarSectionCard")) {
  source = source.replace(
    'import { createBrowserSupabaseClient } from "../../lib/supabase/client";',
    'import { createBrowserSupabaseClient } from "../../lib/supabase/client";\nimport { SidebarSectionCard } from "./sidebar-section-card";'
  );
}
if (!source.includes("MoreVertical")) {
  source = source.replace("Settings2, Smile, Trophy", "Settings2, Smile, MoreVertical, Trophy");
}
if (!source.includes("showChatOptions")) {
  source = source.replace(
    "const [showInvites,setShowInvites]=useState(false);",
    "const [showInvites,setShowInvites]=useState(false);const [showChatOptions,setShowChatOptions]=useState(false);"
  );
}

const oldHeader = '<button type="button" onClick={()=>setSearchOpen(v=>!v)} className="icon-button" aria-label="Search messages"><Search size={18}/></button><button type="button" onClick={()=>void toggleMute()} className="icon-button" aria-label={muted ? "Unmute chat" : "Mute chat"}>{muted ? "🔔" : "🔕"}</button><button type="button" onClick={()=>setShowInvites(v=>!v)} className="icon-button relative" aria-label="Group invitations"><UserPlus size={18}/>{invites.length?<span className="notification-dot">{invites.length}</span>:null}</button>{active?.kind==="group"?';
const newHeader = '<div className="relative"><button type="button" onClick={()=>setShowChatOptions(v=>!v)} className="icon-button" aria-label="Chat options"><MoreVertical size={19}/></button>{showChatOptions?<div className="absolute right-0 top-11 z-50 min-w-44 rounded-2xl border border-[#214a78] bg-[#08182b] p-1.5 shadow-2xl"><button type="button" onClick={()=>{setShowChatOptions(false);void toggleMute();}} className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-xs font-bold hover:bg-[#0b223c]">{muted?"Unmute chat":"Mute chat"}</button><button type="button" onClick={()=>{setShowChatOptions(false);setShowInvites(v=>!v);}} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold hover:bg-[#0b223c]"><span>Group invitations</span>{invites.length?<span className="rounded-full bg-[#126bc0] px-1.5 py-0.5 text-[9px]">{invites.length}</span>:null}</button></div>:null}</div>{active?.kind==="group"?';
if (source.includes(oldHeader)) source = source.replace(oldHeader, newHeader);
else if (!source.includes('aria-label="Chat options"><MoreVertical')) throw new Error("Chat header pattern not found");

const oldSidebar = '<p className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[.14em] text-[#66809a]">Message Friends</p>{friends.length?friends.map(f=><button key={f.id} type="button" onClick={()=>void openPrivate(f)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-[#0a1d32]"><span className="grid size-10 place-items-center rounded-full bg-[#103a60] text-xs font-black text-[#9bd3ff]">{nameOf(f).slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{nameOf(f)}</strong><small className="text-[11px] text-[#7892ac]">@{f.username||"friend"}</small></span><Send size={14} className="text-[#47a8ff]"/></button>):<p className="rounded-2xl bg-[#071426] p-3 text-xs text-[#7892ac]">Accepted friends will appear here.</p>}<p className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[.14em] text-[#66809a]">Private Chats</p>{privateChats.length?privateChats.map(p=><button key={p.group.id} type="button" onClick={()=>{setActive(p.group);setShowRooms(false);}} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${active?.id===p.group.id?"bg-[#0b3154]":"hover:bg-[#0a1d32]"}`}><span className="grid size-10 place-items-center rounded-full bg-[#0b3154] text-xs font-black">{nameOf(p.friend).slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm font-bold">{nameOf(p.friend)}</span></button>):<p className="text-xs text-[#7892ac]">No private chats yet.</p>}<div className="mb-2 mt-5 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#66809a]">My Groups</p><button type="button" onClick={()=>{setInviteSearch("");setInviteCandidates(friends);setShowCreate(true);setShowRooms(false);}} className="rounded-full bg-[#126bc0] px-3 py-1 text-[10px] font-black">New Group</button></div>{groups.length?groups.map(g=><button key={g.id} type="button" onClick={()=>{setActive(g);setShowRooms(false);}} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${active?.id===g.id?"bg-[#0b3154]":"hover:bg-[#0a1d32]"}`}><span className="grid size-10 place-items-center overflow-hidden rounded-xl bg-[#103a60]">{g.image_path?<img src={supabase.storage.from("chat-media").getPublicUrl(g.image_path).data.publicUrl} alt="" className="size-full object-cover"/>:<Users size={17} className="text-[#70c1ff]"/>}</span><span className="min-w-0 flex-1 truncate text-sm font-bold">{g.name}</span>{g.locked?<Lock size={14} className="text-[#7892ac]"/>:null}</button>):<p className="text-xs text-[#7892ac]">No groups yet.</p>}';
const newSidebar = '<SidebarSectionCard title="MESSAGE FRIENDS" description="Connect with your friends and start a conversation." entries={friends.slice(0,2).map(f=>({id:f.id,label:nameOf(f),secondary:`@${f.username||"friend"}`,profile:f,onClick:()=>void openPrivate(f)}))} primaryLabel="Message Friends" secondaryLabel="Add Friends" onPrimary={()=>window.location.assign("/message-friends?tab=friends")} onSecondary={()=>window.location.assign("/friends")} emptyText="No friends available yet."/><SidebarSectionCard title="MY GROUPS" description="Keep your groups close and jump back into the conversations that matter." entries={groups.slice(0,2).map(g=>({id:g.id,label:g.name,secondary:g.locked?"Locked group":"Group",group:true,onClick:()=>{setActive(g);setShowRooms(false);}}))} primaryLabel="View Groups" secondaryLabel="Create Group" onPrimary={()=>window.location.assign("/groups")} onSecondary={()=>{setInviteSearch("");setInviteCandidates(friends);setShowCreate(true);setShowRooms(false);}} emptyText="No groups yet."/>';
if (source.includes(oldSidebar)) source = source.replace(oldSidebar, newSidebar);
else if (!source.includes('<SidebarSectionCard title="MESSAGE FRIENDS"')) throw new Error("Chat sidebar pattern not found");

const oldActive = 'const activeLabel=active?.kind==="private"?(privateChats.find(p=>p.group.id===active.id)?.friend.display_name||privateChats.find(p=>p.group.id===active.id)?.friend.username||"Private chat"):active?.name||"General";';
const newActive = 'const activeLabel=active?.kind==="private"?(active.name||"Private chat"):active?.name||"General";';
source = source.replace(oldActive, newActive);

fs.writeFileSync(path, source);
console.log("Patched rendered ChatHub source.");
