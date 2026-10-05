"use client";

import { useEffect } from "react";
import { POST_SIGNUP_NEXT_KEY } from "@/components/find-refs/RequestRefForm";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * After a new organizer confirms their email they land on the dashboard. If they
 * signed up in the middle of requesting a ref, send them back to finish it (once).
 */
export function ResumeAfterSignup() {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(POST_SIGNUP_NEXT_KEY);
      if (!raw) return;
      localStorage.removeItem(POST_SIGNUP_NEXT_KEY);
      const saved = JSON.parse(raw) as { path?: string; at?: number };
      const fresh = typeof saved.at === "number" && Date.now() - saved.at < MAX_AGE_MS;
      if (fresh && typeof saved.path === "string" && saved.path.startsWith("/find-refs/")) {
        window.location.replace(saved.path);
      }
    } catch {
      // Storage unavailable: stay on the dashboard.
    }
  }, []);
  return null;
}
