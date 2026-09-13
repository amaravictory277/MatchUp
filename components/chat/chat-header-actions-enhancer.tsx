"use client";

import { useEffect } from "react";

export function ChatHeaderActionsEnhancer(){
 useEffect(()=>{
  const apply=()=>{
   const header=document.querySelector<HTMLElement>(".matchup-chat-header");
   if(!header)return;
   const visibleActions=header.querySelector<HTMLElement>(".flex.items-center:last-child");
   if(!visibleActions)return;
   const buttons=[...visibleActions.querySelectorAll<HTMLButtonElement>("button")];
   const originals=buttons.filter(button=>!button.classList.contains("matchup-menu-extra"));
   originals.forEach(button=>{button.style.display="none"});
   const existing=visibleActions.querySelector<HTMLButtonElement>(".matchup-menu-extra");
   if(existing)return;
   const menu=document.createElement("button");
   menu.type="button";menu.className="icon-button matchup-menu-extra";menu.setAttribute("aria-label","Chat options");menu.title="Chat options";menu.textContent="⋮";
   menu.style.fontSize="25px";menu.style.fontWeight="900";menu.style.lineHeight="1";
   menu.onclick=()=>{
    const panel=header.querySelector<HTMLElement>(".matchup-chat-options");
    if(panel){panel.remove();return}
    const options=document.createElement("div");options.className="matchup-chat-options";
    options.innerHTML='<button type="button" data-action="mute">Mute chat</button><button type="button" data-action="settings">Group settings</button>';
    options.querySelector('[data-action="mute"]')?.addEventListener("click",()=>{const mute=originals.find(b=>/mute|notification/i.test(b.getAttribute("aria-label")||b.title||""));mute?.click();options.remove()});
    options.querySelector('[data-action="settings"]')?.addEventListener("click",()=>{const settings=originals.find(b=>/settings/i.test(b.getAttribute("aria-label")||b.title||""));settings?.click();options.remove()});
    header.appendChild(options);
   };
   visibleActions.appendChild(menu);
  };
  const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-label"]});apply();
  return()=>observer.disconnect();
 },[]);
 return null;
}
