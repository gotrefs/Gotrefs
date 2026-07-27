"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDashboardRole } from "./RoleContext";

type NotificationItem = {
  id: string;
  kind: "system" | "message";
  title: string;
  body: string;
  fromLabel?: string;
  createdAt?: string | null;
  targetUrl: string;
  tone?: "red" | "amber" | "green" | "blue";
};

function itemToneClasses(tone: NotificationItem["tone"]) {
  if (tone === "green") return "border-green-100 bg-green-50 text-green-800";
  if (tone === "amber") return "border-amber-100 bg-amber-50 text-amber-800";
  if (tone === "blue") return "border-blue-100 bg-blue-50 text-blue-800";
  return "border-red-100 bg-red-50 text-red-800";
}

function NotificationDropdown({
  icon,
  label,
  items,
}: {
  icon: string;
  label: string;
  items: NotificationItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-black text-[var(--navy)] transition-all duration-200 hover:bg-slate-50"
        aria-label={label}
      >
        <span aria-hidden="true">{icon}</span>
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--red)] px-1 text-[10px] font-black text-white">
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-[var(--border)] bg-white p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-black text-[var(--navy)]">{label}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-[var(--muted)] hover:text-[var(--navy)]"
            >
              Close
            </button>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(item.targetUrl);
                }}
                className={`w-full rounded-xl border p-3 text-left transition-all duration-200 hover:scale-[1.01] ${itemToneClasses(
                  item.tone
                )}`}
              >
                <p className="text-sm font-black">{item.title}</p>
                <p className="mt-1 text-xs opacity-80">{item.body}</p>
              </button>
            ))}
            {items.length === 0 && (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-slate-50 p-4 text-sm text-[var(--muted)]">
                Nothing new right now.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MessagesPanel({
  open,
  items,
  returnLabel,
  returnHref,
  onClose,
}: {
  open: boolean;
  items: NotificationItem[];
  returnLabel: string;
  returnHref: string;
  onClose: () => void;
}) {
  const router = useRouter();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)]">Inbox</p>
          <h2 className="font-display text-xl font-black text-[var(--navy)]">Messages</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            router.push(returnHref);
          }}
          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
        >
          {returnLabel}
        </button>
      </header>
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <p className="mb-4 text-sm text-[var(--muted)]">
          Messages from GotRefs admins, event organizers, and assignors appear here.
        </p>
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-4 ${itemToneClasses(item.tone)}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black">{item.title}</p>
                  {item.fromLabel ? (
                    <p className="mt-1 text-xs font-semibold opacity-80">From {item.fromLabel}</p>
                  ) : null}
                </div>
                {item.createdAt ? (
                  <p className="text-xs opacity-70">{new Date(item.createdAt).toLocaleString()}</p>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 opacity-90">{item.body}</p>
              {item.targetUrl.includes("panel=") ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(item.targetUrl);
                  }}
                  className="mt-3 text-xs font-black underline underline-offset-2"
                >
                  Open related page
                </button>
              ) : null}
            </article>
          ))}
          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-slate-50 p-8 text-center text-sm text-[var(--muted)]">
              No messages yet. When GotRefs or an organizer contacts you, it will show up here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardNotificationCenter() {
  const supabase = useMemo(() => createClient(), []);
  const { currentRole } = useDashboardRole();
  const searchParams = useSearchParams();
  const [systemItems, setSystemItems] = useState<NotificationItem[]>([]);
  const [messageItems, setMessageItems] = useState<NotificationItem[]>([]);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (currentRole === "organizer") {
      const { data: requests } = await supabase
        .from("event_signup_requests")
        .select("id, status, members ( display_name ), scheduled_events!inner ( title, organizer_member_id )")
        .eq("scheduled_events.organizer_member_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(6);

      const { data: offers } = await supabase
        .from("assignment_offers")
        .select("id, status, members ( display_name ), scheduled_events!inner ( title, organizer_member_id )")
        .eq("scheduled_events.organizer_member_id", user.id)
        .in("status", ["accepted", "declined"])
        .order("created_at", { ascending: false })
        .limit(6);

      const requestItems =
        requests?.map((request) => {
          const member = Array.isArray(request.members) ? request.members[0] : request.members;
          const event = Array.isArray(request.scheduled_events)
            ? request.scheduled_events[0]
            : request.scheduled_events;
          return {
            id: `request-${request.id}`,
            kind: "system" as const,
            title: "New ref application",
            body: `${member?.display_name ?? "A referee"} applied to ref ${event?.title ?? "your event"}.`,
            targetUrl: "/dashboard/organizer?panel=requests",
            tone: "red" as const,
          };
        }) ?? [];

      const offerItems =
        offers?.map((offer) => {
          const member = Array.isArray(offer.members) ? offer.members[0] : offer.members;
          const event = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
          const accepted = offer.status === "accepted";
          return {
            id: `offer-${offer.id}`,
            kind: "system" as const,
            title: `Invite ${offer.status}`,
            body: `${member?.display_name ?? "A referee"} ${offer.status} ${event?.title ?? "your event"}.`,
            targetUrl: "/dashboard/organizer?panel=responses",
            tone: accepted ? ("green" as const) : ("amber" as const),
          };
        }) ?? [];

      setSystemItems([...requestItems, ...offerItems]);
      setMessageItems([]);
      return;
    }

    const { data: offers } = await supabase
      .from("assignment_offers")
      .select("id, status, scheduled_events ( title, sport, starts_at )")
      .eq("ref_member_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(6);

    const { data: inquiries } = await supabase
      .from("ref_inquiries")
      .select("id, subject, message, created_at, members ( display_name )")
      .eq("ref_member_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);

    const { data: verification } = await supabase
      .from("ref_verification_submissions")
      .select("status, admin_notes, updated_at, reviewed_at, fix_required_steps")
      .eq("ref_member_id", user.id)
      .maybeSingle();

    setSystemItems(
      offers?.map((offer) => {
        const event = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
        return {
          id: `offer-${offer.id}`,
          kind: "system" as const,
          title: "New organizer invite",
          body: `${event?.title ?? "An organizer"} invited you to work a game.`,
          targetUrl: "/dashboard/referee?panel=offers",
          tone: "red" as const,
        };
      }) ?? []
    );

    const messages: NotificationItem[] = [];

    if (verification?.admin_notes?.trim()) {
      const status = verification.status ?? "draft";
      const tone =
        status === "approved" ? "green" : status === "rejected" ? "red" : status === "submitted" ? "blue" : "amber";
      messages.push({
        id: `admin-verification-${verification.reviewed_at ?? verification.updated_at ?? "note"}`,
        kind: "message",
        title:
          status === "approved"
            ? "Verification approved"
            : status === "rejected"
              ? "Verification not approved"
              : Array.isArray(verification.fix_required_steps) && verification.fix_required_steps.length > 0
                ? "GotRefs requested updates"
                : "Message from GotRefs",
        body: verification.admin_notes.trim(),
        fromLabel: "GotRefs admin",
        createdAt: verification.reviewed_at ?? verification.updated_at ?? null,
        targetUrl: "/dashboard/referee",
        tone,
      });
    }

    for (const inquiry of inquiries ?? []) {
      const member = Array.isArray(inquiry.members) ? inquiry.members[0] : inquiry.members;
      messages.push({
        id: `inquiry-${inquiry.id}`,
        kind: "message",
        title: inquiry.subject || "Organizer message",
        body: inquiry.message,
        fromLabel: member?.display_name ?? "Event organizer",
        createdAt: inquiry.created_at,
        targetUrl: "/dashboard/referee",
        tone: "blue",
      });
    }

    setMessageItems(messages);
  }, [currentRole, supabase]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    if (searchParams.get("panel") === "messages") {
      setMessagesOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-notifications-${currentRole}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_offers" }, () => {
        setToast("Assignment update received.");
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_signup_requests" }, () => {
        setToast("New event request update received.");
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ref_inquiries" }, () => {
        setToast("New message received.");
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ref_verification_submissions" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentRole, load, supabase]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const returnHref = currentRole === "organizer" ? "/dashboard/organizer" : "/dashboard/referee";
  const returnLabel = currentRole === "organizer" ? "Return to Events" : "Return to Games";

  return (
    <>
      <NotificationDropdown icon="🔔" label="Notifications" items={systemItems} />
      <button
        type="button"
        onClick={() => setMessagesOpen(true)}
        className="relative rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-black text-[var(--navy)] transition-all duration-200 hover:bg-slate-50"
        aria-label="Messages"
      >
        <span aria-hidden="true">✉</span>
        {messageItems.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--red)] px-1 text-[10px] font-black text-white">
            {messageItems.length}
          </span>
        )}
      </button>
      <MessagesPanel
        open={messagesOpen}
        items={messageItems}
        returnLabel={returnLabel}
        returnHref={returnHref}
        onClose={() => setMessagesOpen(false)}
      />
      {toast && (
        <div className="fixed right-4 top-20 z-[60] rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--navy)] shadow-2xl">
          {toast}
        </div>
      )}
    </>
  );
}
