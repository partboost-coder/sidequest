"use client";

import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

type SessionState =
  { id: string; isAnonymous: boolean; source: string } | { error: string } | undefined;

/** Dev-only indicator: proves a stable guest identity exists across reloads. */
export default function SessionBadge() {
  const [session, setSession] = useState<SessionState>();

  useEffect(() => {
    fetch("/api/session")
      .then(async (res) => {
        const json = await res.json();
        setSession(res.ok ? json.user : { error: json.message ?? json.error });
      })
      .catch((e: Error) => setSession({ error: e.message }));
  }, []);

  if (!session) return <Badge variant="outline">Session…</Badge>;
  if ("error" in session)
    return <Badge variant="destructive">Session error: {session.error}</Badge>;
  return (
    <Badge variant="secondary" title={session.id}>
      <UserRound aria-hidden />
      {session.isAnonymous ? "Guest" : "User"} {session.id.slice(0, 4)}…{session.id.slice(-4)} ·{" "}
      {session.source}
    </Badge>
  );
}
