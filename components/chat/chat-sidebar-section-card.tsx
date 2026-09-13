"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MatchUpAvatar } from "../ui/matchup-avatar";

type SidebarEntry={name:string;source?:HTMLElement};
type SectionCardProps={entries:SidebarEntry[];description:string;leftLabel:string;rightLabel:string;leftHref:string;rightHref:string;emptyLabel:string};

function SectionCard({entries,description,leftLabel,rightLabel,leftHref,rightHref,emptyLabel}:SectionCardProps){
 const runSource=(entry:SidebarEntry)=>{if(entry.source){entry.source.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window}));return}window.location.assign(leftHref)};
 return <div className="mt-3 rounded-3xl border border-[#18365f] bg-[#071426] p-3 shadow-[0_12px_34px_rgba(0,0,0,.18)]">
  <p className="mb-3 px-1 text-xs leading-5 text-[#7892ac]">{description}</p>
  <div className="space-y-2">
   {entries.slice(0,2).map((entry,index)=><button key={`${entry.name}-${index}`} type="button" onClick={()=>runSource(entry)} className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-[#102b49] bg-[#0a1b2f] p-3 text-left transition hover:border-[#245b91]">
    <MatchUpAvatar profile={{display_name:entry.name}} size="sm" alt={entry.name}/>
    <span className="min-w-0 flex-1 truncate text-sm font-black text-white">{entry.name}</span>
   </button>)}
   {!entries.length?<p className="px-2 py-3 text-xs font-bold text-[#7892ac]">{emptyLabel}</p>:null}
  </div>
  <div className="mt-3 grid grid-cols-2 gap-2">
   <button type="button" onClick={()=>window.location.assign(leftHref)} className="min-w-0 rounded-xl bg-[#167bd1] px-3 py-2.5 text-[11px] font-black text-white transition hover:bg-[#2497ff]">{leftLabel}</button>
   <button type="button" onClick={()=>window.location.assign(rightHref)} className="min-w-0 rounded-xl border border-[#245b91] bg-[#0a2946] px-3 py-2.5 text-[11px] font-black text-[#9bd3ff] transition hover:border-[#47a8ff]">{rightLabel}</button>
  </div>
 </div>;
}

function exactHeading(drawer:HTMLElement,label:string){return [...drawer.querySelectorAll<HTMLElement>("p,h2,h3,h4,div,span")].find(el=>el.children.length===0&&(el.textContent||"").trim()===label)||null;}
function sectionLines(drawer:HTMLElement,label:string,nextLabel?:string){const text=(drawer.innerText||"").split("\n").map(x=>x.trim()).filter(Boolean);const start=text.findIndex(x=>x===label);if(start<0)return[];const end=nextLabel?text.findIndex((x,i)=>i>start&&x===nextLabel):text.length;return text.slice(start+1,end<0?text.length:end);}
function entriesFromLines(drawer:HTMLElement,lines:string[],excluded:string[]){const clean=lines.filter(x=>!excluded.includes(x)&&x.length>1&&!/^@/.test(x)&&!/^\d+(\s|$)/.test(x));return [...new Set(clean)].slice(0,2).map(name=>{const source=[...drawer.querySelectorAll<HTMLElement>("button,a,[role='button'],div,span")].find(el=>(el.textContent||"").trim()===name)||undefined;return {name,source}});}
function hideBetween(start:HTMLElement,end:HTMLElement|null){const parent=start.parentElement;if(!parent)return;let node:Element|null=start;while(node){(node as HTMLElement).style.display=node===start?"block":"none";if(node===end)break;node=node.nextElementSibling;}}

export function ChatSidebarSectionCards(){
 const roots=useRef<Array<{mount:HTMLElement;root:Root}>>([]);
 useEffect(()=>{
  let queued=false;let internalMutation=false;let observer:MutationObserver;
  const clear=()=>{roots.current.forEach(({mount,root})=>{root.unmount();mount.remove()});roots.current=[];};
  const renderCard=(mount:HTMLElement,element:ReactElement)=>{const root=createRoot(mount);root.render(element);roots.current.push({mount,root});};
  const apply=()=>{
   if(queued||internalMutation)return;queued=true;
   window.requestAnimationFrame(()=>{
    queued=false;internalMutation=true;
    const drawer=document.querySelector<HTMLElement>(".matchup-chat aside");
    if(!drawer){internalMutation=false;return;}
    clear();
    const messageHeading=exactHeading(drawer,"MESSAGE FRIENDS");
    const privateHeading=exactHeading(drawer,"PRIVATE CHATS");
    const groupsHeading=exactHeading(drawer,"MY GROUPS");
    if(messageHeading){
     const lines=sectionLines(drawer,"MESSAGE FRIENDS","PRIVATE CHATS");
     const entries=entriesFromLines(drawer,lines,["General","Global MatchUp chat","Create Group","View Groups","Message Friends","Add Friends"]);
     const mount=document.createElement("div");mount.className="matchup-sidebar-card-mount";messageHeading.parentElement?.insertBefore(mount,messageHeading.nextSibling||null);
     hideBetween(messageHeading,privateHeading);mount.style.display="block";
     renderCard(mount,<SectionCard entries={entries} description="Connect with your friends and start a conversation." leftLabel="Message Friends" rightLabel="Add Friends" leftHref="/message-friends?tab=friends" rightHref="/friends" emptyLabel="No friends available yet."/>);
    }
    if(privateHeading){privateHeading.style.display="none";if(groupsHeading&&privateHeading.parentElement===groupsHeading.parentElement)hideBetween(privateHeading,groupsHeading);}
    if(groupsHeading){
     const lines=sectionLines(drawer,"MY GROUPS");
     const entries=entriesFromLines(drawer,lines,["Create Group","View Groups","Message Friends","Add Friends","MESSAGE FRIENDS","PRIVATE CHATS"]);
     const mount=document.createElement("div");mount.className="matchup-sidebar-card-mount";groupsHeading.parentElement?.insertBefore(mount,groupsHeading.nextSibling||null);
     let node=groupsHeading.nextElementSibling;while(node){const next=node.nextElementSibling;if(node!==mount)(node as HTMLElement).style.display="none";node=next;}
     renderCard(mount,<SectionCard entries={entries} description="Keep your groups close and jump back into the conversations that matter." leftLabel="View Groups" rightLabel="Create Group" leftHref="/groups" rightHref="/leaderboard?create=group" emptyLabel="No groups yet."/>);
    }
   window.requestAnimationFrame(()=>{internalMutation=false;});
   });
  };
  observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true});apply();
  return()=>{observer.disconnect();clear();};
 },[]);
 return null;
}
