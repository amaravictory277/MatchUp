"use client";

import { useEffect } from "react";

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

export function ChatVisualEnhancer(){
  useEffect(()=>{
    const apply=()=>document.querySelectorAll<HTMLElement>('[data-message-id]').forEach(row=>{
      const title=row.querySelector<HTMLElement>('[title]')?.getAttribute('title');
      if(!title)return;
      const date=new Date(title);
      if(Number.isNaN(date.getTime()))return;
      const rel=relative(date);
      const formatted=date.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
      row.dataset.chatRelative=rel;
      row.dataset.chatDate=formatted;
      const footer=row.querySelector<HTMLElement>('.mt-1.flex.items-center.justify-end');
      if(footer){footer.dataset.chatTime=rel;footer.dataset.chatDate=formatted;}
    });
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{subtree:true,childList:true});
    const timer=window.setInterval(apply,30000);
    return()=>{observer.disconnect();window.clearInterval(timer);};
  },[]);
  return null;
}
