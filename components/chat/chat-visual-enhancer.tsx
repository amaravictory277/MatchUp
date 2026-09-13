"use client";

import { useEffect } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

const DEFAULT_AVATARS = ["/avatars/matchup-avatar-1.svg", "/avatars/matchup-avatar-2.svg", "/avatars/matchup-avatar-3.svg"];

function relative(value: Date){
  const mins=Math.max(0,Math.floor((Date.now()-value.getTime())/60000));
  if(mins<1)return "Just now";
  if(mins<60)return `${mins} minute${mins===1?"":"s"} ago`;
  const hours=Math.floor(mins/60);
  if(hours<24)return `${hours} hour${hours===1?"":"s"} ago`;
  const days=Math.floor(hours/24);
  if(days===1)return "Yesterday";
  return `${days} days ago`;
}

function hash(value:string){let h=0;for(let i=0;i<value.length;i++)h=(h*31+value.charCodeAt(i))>>>0;return h;}

function dateLabel(date:Date){
  const now=new Date();
  const start=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  const delta=Math.round((start(now)-start(date))/86400000);
  if(delta===0)return "Today";
  if(delta===1)return "Yesterday";
  return date.toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});
}

function readableColor(rgb:number[]){
  const [r,g,b]=rgb; const max=Math.max(r,g,b); const min=Math.min(r,g,b); const l=(max+min)/510;
  const lift=l<.42?1.45:l>.8?.86:1;
  const rr=Math.min(255,Math.round(r*lift+18)); const gg=Math.min(255,Math.round(g*lift+18)); const bb=Math.min(255,Math.round(b*lift+18));
  return `rgb(${rr}, ${gg}, ${bb})`;
}

async function dominantColor(src:string):Promise<string|null>{
  if(typeof window==="undefined")return null;
  try{
    const img=new Image(); img.crossOrigin="anonymous"; img.src=src;
    await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("image"));});
    const canvas=document.createElement("canvas"); canvas.width=32; canvas.height=32; const ctx=canvas.getContext("2d"); if(!ctx)return null;
    ctx.drawImage(img,0,0,32,32); const data=ctx.getImageData(0,0,32,32).data; const buckets=new Map<number,number>();
    for(let i=0;i<data.length;i+=4){const a=data[i+3],r=data[i],g=data[i+1],b=data[i+2];if(a<100||r>238&&g>238&&b>238||r<18&&g<18&&b<18)continue;const q=(Math.round(r/24)<<16)|(Math.round(g/24)<<8)|Math.round(b/24);buckets.set(q,(buckets.get(q)||0)+1);}
    const top=[...buckets.entries()].sort((a,b)=>b[1]-a[1])[0]; if(!top)return null; const r=((top[0]>>16)&255)*24,g=((top[0]>>8)&255)*24,b=(top[0]&255)*24; return readableColor([r,g,b]);
  }catch{return null;}
}

export function ChatVisualEnhancer(){
  useEffect(()=>{
    const supabase=createBrowserSupabaseClient();
    let cancelled=false;
    const apply=async()=>{
      if(cancelled)return;
      const rows=[...document.querySelectorAll<HTMLElement>('[data-message-id]')];
      let previousDate="";
      rows.forEach(row=>{
        const title=row.querySelector<HTMLElement>('[title]')?.getAttribute("title"); if(!title)return;
        const date=new Date(title); if(Number.isNaN(date.getTime()))return;
        const label=dateLabel(date); row.dataset.chatRelative=relative(date); row.dataset.chatDate=label;
        const footer=row.querySelector<HTMLElement>('.mt-1.flex.items-center.justify-end'); if(footer){footer.dataset.chatTime=relative(date);footer.dataset.chatDate=label;}
        if(label!==previousDate){
          const existing=row.previousElementSibling;
          if(!(existing instanceof HTMLElement&&existing.classList.contains("matchup-date-separator"))){const sep=document.createElement("div");sep.className="matchup-date-separator";sep.textContent=label;row.parentElement?.insertBefore(sep,row);}
          previousDate=label;
        }
        const other=row.querySelector<HTMLElement>(".matchup-chat-bubble-other"); const header=other?.querySelector<HTMLElement>("div:first-child"); const sender=header?.querySelector<HTMLElement>("span:first-child");
        if(sender&&header){
          const name=sender.textContent?.trim()||"MatchUp Player"; header.dataset.chatAvatar=name.slice(0,1).toUpperCase(); sender.classList.add("matchup-personalized-name");
          if(!header.querySelector(".matchup-avatar-mini")){
            const mini=document.createElement("img"); mini.className="matchup-avatar-mini"; mini.alt=`${name} avatar`; mini.width=24;mini.height=24; mini.src=DEFAULT_AVATARS[hash(name)%DEFAULT_AVATARS.length]; mini.style.cssText="position:absolute;left:0;top:-2px;width:24px;height:24px;border-radius:8px;object-fit:cover;border:1px solid #194b7c"; header.appendChild(mini);
          }
          const cached=localStorage.getItem(`matchup-name-color:${name}`); if(cached) sender.style.color=cached;
          if(!cached)void (async()=>{const {data}=await supabase.from("profiles").select("avatar_path").eq("display_name",name).limit(1).maybeSingle();const src=data?.avatar_path;const color=src?await dominantColor(src):null;const final=color||"#70c1ff";localStorage.setItem(`matchup-name-color:${name}`,final);if(!cancelled)sender.style.color=final;})();
        }
      });
    };
    void apply(); const observer=new MutationObserver(()=>void apply()); observer.observe(document.body,{subtree:true,childList:true}); const timer=window.setInterval(()=>void apply(),30000);
    return()=>{cancelled=true;observer.disconnect();window.clearInterval(timer);};
  },[]);
  return null;
}
