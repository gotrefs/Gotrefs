"use client";

import { useState } from "react";
import { formatEventLocation } from "@/data/sports";

export type RefWorkOffer = {
  id: string;
  status: string;
  offered_pay: number | null;
  message: string | null;
  scheduled_events:
    | {
        title: string;
        sport: string;
        starts_at: string;
        zip_code: string;
        city: string | null;
        state: string | null;
      }
    | {
        title: string;
        sport: string;
        starts_at: string;
        zip_code: string;
        city: string | null;
        state: string | null;
      }[]
    | null;
};

export type RefWorkApplication = {
  id: string;
  event_id: string;
  status: string;
  created_at: string;
  scheduled_events:
    | {
        title: string;
        sport: string;
        starts_at: string;
        city: string | null;
        state: string | null;
        zip_code: string;
      }
    | {
        title: string;
        sport: string;
        starts_at: string;
        city: string | null;
        state: string | null;
        zip_code: string;
      }[]
    | null;
};

export type RefWorkBooking = {
  id: string;
  event_id: string;
  status: string;
  scheduled_events:
    | {
        title: string;
        sport: string;
        starts_at: string;
        ends_at: string;
        city: string | null;
        state: string | null;
        zip_code: string;
      }
    | {
        title: string;
        sport: string;
        starts_at: string;
        ends_at: string;
        city: string | null;
        state: string | null;
        zip_code: string;
      }[]
    | null;
};

type WorkSubTab = "invites" | "applied" | "confirmed";

function eventFromJoin<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function RefMyWorkPanel({
  offers,
  applications,
  bookings,
  onReload,
}: {
  offers: RefWorkOffer[];
  applications: RefWorkApplication[];
  bookings: RefWorkBooking[];
  onReload: () => Promise<void> | void;
}) {
  const [subTab, setSubTab] = useState<WorkSubTab>("invites");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const pendingInvites = offers.filter((offer) => offer.status === "pending");
  const pendingApplications = applications.filter((app) => app.status === "pending");
  const confirmedBookings = bookings.filter((booking) =>
    ["confirmed", "completed"].includes(booking.status)
  );

  async function respondToOffer(offerId: string, action: "accept" | "decline") {
    setBusyId(offerId);
    setMsg(null);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(json.error || "Could not update this invite.");
        return;
      }
      setMsg(action === "accept" ? "Invite accepted — game confirmed on your schedule." : "Invite declined.");
      await onReload();
    } catch {
      setMsg("Could not reach the server. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  const subTabs: { id: WorkSubTab; label: string; count: number }[] = [
    { id: "invites", label: "Invites", count: pendingInvites.length },
    { id: "applied", label: "Applied", count: pendingApplications.length },
    { id: "confirmed", label: "Confirmed", count: confirmedBookings.length },
  ];

  return (
    <section className="space-y-4">
      <section className="space-y-2">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)]">My work</p>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">Trips & requests</h2>
        <p className="text-sm text-neutral-500">
          Organizer invites, your applications, and confirmed games — like Airbnb Trips.
        </p>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              subTab === tab.id
                ? "bg-[var(--navy)] text-white"
                : "border border-[var(--border)] text-[var(--navy)] hover:bg-slate-50"
            }`}
          >
            {tab.label}
            {tab.count > 0 ? ` (${tab.count})` : ""}
          </button>
        ))}
      </div>

      {msg && (
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-[var(--navy)]">
          {msg}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {subTab === "invites" &&
          (pendingInvites.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] bg-slate-50 p-5 text-sm text-[var(--muted)]">
              No pending organizer invites. Browse open games and apply, or wait for organizers to reach out.
            </p>
          ) : (
            pendingInvites.map((offer) => {
              const ev = eventFromJoin(offer.scheduled_events);
              const loc = ev ? formatEventLocation(ev.city, ev.state, ev.zip_code) : "";
              return (
                <article key={offer.id} className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--red)]">Organizer invite</p>
                  <p className="mt-1 text-lg font-black text-[var(--navy)]">{ev?.title ?? "Game"}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {ev?.sport}
                    {ev?.starts_at ? ` · ${new Date(ev.starts_at).toLocaleString()}` : ""}
                    {loc ? ` · ${loc}` : ""}
                  </p>
                  {offer.offered_pay != null && (
                    <p className="mt-2 text-sm font-bold text-emerald-700">Offered pay: ${offer.offered_pay}</p>
                  )}
                  {offer.message?.trim() && <p className="mt-2 text-sm text-[var(--slate)]">{offer.message}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === offer.id}
                      onClick={() => void respondToOffer(offer.id, "accept")}
                      className="rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {busyId === offer.id ? "Saving…" : "Accept invite"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === offer.id}
                      onClick={() => void respondToOffer(offer.id, "decline")}
                      className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-[var(--navy)] disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </article>
              );
            })
          ))}

        {subTab === "applied" &&
          (pendingApplications.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] bg-slate-50 p-5 text-sm text-[var(--muted)]">
              You have not applied to any open games yet. Use Find Games to request work.
            </p>
          ) : (
            pendingApplications.map((app) => {
              const ev = eventFromJoin(app.scheduled_events);
              return (
                <article key={app.id} className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-indigo-700">Application pending</p>
                  <p className="mt-1 text-lg font-black text-[var(--navy)]">{ev?.title ?? "Game"}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {ev?.sport}
                    {ev?.starts_at ? ` · ${new Date(ev.starts_at).toLocaleString()}` : ""}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                    Applied {new Date(app.created_at).toLocaleString()}
                  </p>
                </article>
              );
            })
          ))}

        {subTab === "confirmed" &&
          (confirmedBookings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] bg-slate-50 p-5 text-sm text-[var(--muted)]">
              No confirmed games yet. Accept an organizer invite to add games to your schedule.
            </p>
          ) : (
            confirmedBookings.map((booking) => {
              const ev = eventFromJoin(booking.scheduled_events);
              const loc = ev ? formatEventLocation(ev.city, ev.state, ev.zip_code) : "";
              return (
                <article key={booking.id} className="rounded-2xl border border-green-200 bg-green-50/60 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-green-700">Confirmed</p>
                  <p className="mt-1 text-lg font-black text-[var(--navy)]">{ev?.title ?? "Game"}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {ev?.sport}
                    {ev?.starts_at ? ` · ${new Date(ev.starts_at).toLocaleString()}` : ""}
                    {loc ? ` · ${loc}` : ""}
                  </p>
                </article>
              );
            })
          ))}
      </div>
    </section>
  );
}
