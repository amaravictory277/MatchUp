'use client';

import { useEffect, useRef } from 'react';
import { createBrowserSupabaseClient } from '../lib/supabase/client';

const CHANNEL_NAME = 'matchup:online-users';
const LAST_SEEN_INTERVAL_MS = 5 * 60 * 1000;

type PresenceState = { user_id: string; session_id: string };

function createSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PresenceProvider() {
  const lastSeenRef = useRef(0);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    let touchTimer: ReturnType<typeof setInterval> | null = null;
    let starting = false;

    const touchLastSeen = async () => {
      const now = Date.now();
      if (now - lastSeenRef.current < 60_000) return;
      lastSeenRef.current = now;
      await supabase.rpc('touch_last_seen');
    };

    const stop = async (touch = false) => {
      if (touch) await touchLastSeen();
      if (touchTimer) clearInterval(touchTimer);
      touchTimer = null;
      if (channel) {
        await channel.untrack().catch(() => undefined);
        await channel.unsubscribe().catch(() => undefined);
      }
      channel = null;
    };

    const start = async () => {
      if (starting || channel || stopped) return;
      starting = true;
      const { data } = await supabase.auth.getSession();
      if (stopped || !data.session?.user) {
        starting = false;
        return;
      }

      const userId = data.session.user.id;
      const nextChannel = supabase.channel(CHANNEL_NAME, { config: { presence: { key: userId } } });
      nextChannel.on('presence', { event: 'sync' }, () => undefined);
      nextChannel.on('presence', { event: 'join' }, () => undefined);
      nextChannel.on('presence', { event: 'leave' }, () => undefined);
      channel = nextChannel;
      starting = false;

      nextChannel.subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || stopped || channel !== nextChannel) return;
        const payload: PresenceState = { user_id: userId, session_id: createSessionId() };
        await nextChannel.track(payload);
        await touchLastSeen();
      });
      touchTimer = setInterval(touchLastSeen, LAST_SEEN_INTERVAL_MS);
    };

    void start();
    const onVisibility = () => { if (document.visibilityState === 'visible') void touchLastSeen(); };
    document.addEventListener('visibilitychange', onVisibility);

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) void start();
      if (event === 'SIGNED_OUT' || !session) void stop(true);
    });

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      authListener.subscription.unsubscribe();
      if (touchTimer) clearInterval(touchTimer);
      void stop(false);
    };
  }, []);

  return null;
}
