"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_MS = 45_000;

export function PresenceTracker() {
  const pathname = usePathname();
  const sessionId = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    sessionId.current ??= crypto.randomUUID();
    let active = true;
    let rpcAvailable = true;
    const heartbeat = async () => {
      if (!active || !rpcAvailable || document.visibilityState === "hidden") return;
      try {
        const { error } = await supabase.rpc("touch_user_presence", {
          target_session: sessionId.current,
          target_path: pathname,
        });
        // Presence is non-critical. Stop retrying for this route when the RPC is
        // unavailable or the browser cannot reach Supabase.
        if (error) rpcAvailable = false;
      } catch {
        rpcAvailable = false;
      }
    };
    let timer:number|undefined;
    void supabase.auth.getSession().then(({data})=>{
      if(!active||!data.session?.user)return;
      void heartbeat();
      timer=window.setInterval(() => void heartbeat(), HEARTBEAT_MS);
    }).catch(() => undefined);
    const onVisibility = () => { if (document.visibilityState === "visible") void heartbeat(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      if(timer!==undefined)window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  return null;
}
