"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChatHub } from "../../components/chat/chat-hub";
import { MessageInteractionLayer } from "../../components/chat/message-interaction-layer";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

function ChatRoute(){
  const params=useSearchParams();
  const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);
  const requestedGroup=params.get("group")||"";
  const friendId=params.get("friend")||"";
  const [resolvedGroup,setResolvedGroup]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{
    if(requestedGroup || !friendId) return;
    let active=true;
    const resolve=async()=>{
      const { data: auth }=await supabase.auth.getUser();
      if(!auth.user){ if(active) setError("Sign in to open a private chat."); return; }
      const { data, error: rpcError }=await supabase.rpc("get_or_create_private_chat",{p_friend:friendId});
      if(active){
        if(rpcError) setError(rpcError.message);
        else setResolvedGroup(data || "");
      }
    };
    void resolve();
    return()=>{active=false;};
  },[friendId,requestedGroup,supabase]);

  const groupId=requestedGroup || resolvedGroup;
  return (
    <main className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#061120]">
      {error ? <div className="fixed left-1/2 top-4 z-[120] w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-[#6c2736] bg-[#24151a] px-4 py-3 text-sm text-[#ffb2bc]">{error}</div> : null}
      <ChatHub initialGroupId={groupId||undefined}/>
      <MessageInteractionLayer/>
    </main>
  );
}

export default function LeaderboardPage(){
  return <Suspense fallback={<main className="h-[100dvh] bg-[#061120]"/>}><ChatRoute/></Suspense>
}
