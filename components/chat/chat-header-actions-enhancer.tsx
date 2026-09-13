"use client";

import { useEffect } from "react";

export function ChatHeaderActionsEnhancer(){
 useEffect(()=>{
  const apply=()=>{
   const header=document.querySelector<HTMLElement>(".matchup-chat-header");
   if(!header)return;
   const buttons=[...header.querySelectorAll<HTMLButtonElement>("button")];
   const removable=/^(search|mute chat|unmute chat|notifications?|add friend|invite|group invitations?|group settings)$/i;
   buttons.forEach(button=>{
    if(button.classList.contains("matchup-menu-extra"))return;
    const label=(button.getAttribute("aria-label")||button.title||button.textContent||"").trim();
    if(removable.test(label))button.style.display="none";
   });
   if(header.querySelector(".matchup-menu-extra"))return;
   const visibleActions=header.querySelector<HTMLElement>(".flex.items-center:last-child")||header;
   const menu=document.createElement("button");
   menu.type="button";menu.className="icon-button matchup-menu-extra";menu.setAttribute("aria-label","Chat options");menu.title="Chat options";menu.textContent="⋮";
   menu.style.fontSize="25px";menu.style.fontWeight="900";menu.style.lineHeight="1";
   menu.onclick=()=>{
    const existing=header.querySelector<HTMLElement>(".matchup-chat-options");
    if(existing){existing.remove();return;}
    const panel=document.createElement("div");panel.className="matchup-chat-options";
    panel.innerHTML='<button type="button" data-action="mute">Mute chat</button><button type="button" data-action="settings">Group settings</button>';
    panel.querySelector('[data-action="mute"]')?.addEventListener("click",()=>{const mute=buttons.find(b=>/mute chat|unmute chat/i.test(b.getAttribute("aria-label")||""));mute?.click();panel.remove()});
    panel.querySelector('[data-action="settings"]')?.addEventListener("click",()=>{const settings=buttons.find(b=>/group settings/i.test(b.getAttribute("aria-label")||""));settings?.click();panel.remove()});
    header.appendChild(panel);
   };
   visibleActions.appendChild(menu);
  };
  const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-label"]});apply();
  return()=>observer.disconnect();
 },[]);
 return null;
}
