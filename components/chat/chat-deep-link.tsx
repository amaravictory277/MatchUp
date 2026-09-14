"use client";
import { useEffect, useMemo } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export function ChatDeepLink({groupId,friendId,createGroup=false}:{groupId?:string;friendId?:string;createGroup?:boolean}){
 const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);
 useEffect(()=>{if(!groupId&&!friendId&&!createGroup)return;let cancelled=false;let observer:MutationObserver|undefined;const open=async()=>{const label=createGroup?"New Group":groupId?(await supabase.from("chat_groups").select("name").eq("id",groupId).maybeSingle()).data?.name:((await supabase.from("profiles").select("display_name,username").eq("id",friendId!).maybeSingle()).data?.display_name||"MatchUp Player");if(!label||cancelled)return;const tryOpen=()=>{if(cancelled)return;const menu=document.querySelector<HTMLButtonElement>('button[aria-label="Open chats and groups"]');if(menu&&!menu.dataset.deepLinkOpened){menu.dataset.deepLinkOpened="true";menu.click();}const target=Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(b=>b.textContent?.trim().includes(label));if(target&&!target.dataset.deepLinkTarget){target.dataset.deepLinkTarget="true";target.click();observer?.disconnect();}};observer=new MutationObserver(tryOpen);observer.observe(document.body,{childList:true,subtree:true});tryOpen();window.setTimeout(()=>observer?.disconnect(),8000);};void open();return()=>{cancelled=true;observer?.disconnect();};},[groupId,friendId,createGroup,supabase]);return null;
}
