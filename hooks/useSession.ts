"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => hasSupabaseConfig());

  useEffect(() => {
    if (!hasSupabaseConfig()) return;

    const supabase = createClient();
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error("Could not restore the Supabase session.", error);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const username =
    typeof user?.user_metadata.username === "string" ? user.user_metadata.username : null;

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) throw error;
    setUser(null);
  }

  return { user, username, loading, signOut };
}
