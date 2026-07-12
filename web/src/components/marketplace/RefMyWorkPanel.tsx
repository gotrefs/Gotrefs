"use client";

import { useState } from "react";
import { formatEventLocation } from "@/data/sports";
import {
  AirbnbAcceptProfile,
  acceptPhotosForSport,
} from "@/components/marketplace/AirbnbAcceptProfile";

export type RefWorkOffer = {
  id: string;
  status: string;
  offered_pay: number | null;
  message: string | null;
  organizer?: {
    displayName: string | null;
    profilePictureUrl: string | null;
  } | null;
  scheduled_events:
    | {
        title: string;
        sport: string;
        starts_at: string;
        zip_code: string;
        city: string | null;
        state: string | null;
        organizer_member_id?: string;
      }
    | {
        title: string;
        sport: string;
        starts_at: string;
        zip_code: string;
        city: string | null;
        state: string | null;
        organizer_member_id?: string;
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
    <section className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Trips</h2>
        <p className="text-sm text-neutral-500">Invites, applications, and confirmed games.</p>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              subTab === tab.id
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            {tab.label}
            {tab.count > 0 ? ` (${tab.count})` : ""}
          </button>
        ))}
      </div>

      {msg && (
        <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-800">
          {msg}
        </p>
      )}

      <div className="space-y-5">
        {subTab === "invites" &&
          (pendingInvites.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-sm text-neutral-500">
              No pending organizer invites. Browse open games and apply, or wait for organizers to reach out.
            </p>
          ) : (
            pendingInvites.map((offer) => {
              const ev = eventFromJoin(offer.scheduled_events);
              const loc = ev ? formatEventLocation(ev.city, ev.state, ev.zip_code) : "";
              const hostName = offer.organizer?.displayName?.trim() || "your host";
              const sport = ev?.sport || "Game";
              return (
                <AirbnbAcceptProfile
                  key={offer.id}
                  photoUrls={acceptPhotosForSport(sport, offer.organizer?.profilePictureUrl)}
                  photoAlt={`${hostName} game invite`}
                  sportForVisual={sport}
                  eyebrow="Organizer invite"
                  title={`Hey, I'm ${hostName.split(" ")[0] || hostName}`}
                  subtitle={ev?.title ? `Invited you to ${ev.title}` : "Invited you to referee a game"}
                  emptyReviewsLabel="New host"
                  reviewsTitle="About this host"
                  reviews={[]}
                  metaRows={[
                    [sport, ev?.starts_at ? new Date(ev.starts_at).toLocaleString() : null, loc]
                      .filter(Boolean)
                      .join(" · "),
                    offer.offered_pay != null ? `Offered pay $${offer.offered_pay}` : null,
                  ].filter(Boolean) as string[]}
                  message={offer.message}
                  primaryLabel="Accept"
                  secondaryLabel="Decline"
                  busy={busyId === offer.id}
                  onPrimary={() => void respondToOffer(offer.id, "accept")}
                  onSecondary={() => void respondToOffer(offer.id, "decline")}
                />
              );
            })
          ))}

        {subTab === "applied" &&
          (pendingApplications.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-sm text-neutral-500">
              You have not applied to any open games yet. Use Explore to request work.
            </p>
          ) : (
            pendingApplications.map((app) => {
              const ev = eventFromJoin(app.scheduled_events);
              return (
                <article key={app.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Application pending</p>
                  <p className="mt-1 text-lg font-semibold text-neutral-900">{ev?.title ?? "Game"}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {ev?.sport}
                    {ev?.starts_at ? ` · ${new Date(ev.starts_at).toLocaleString()}` : ""}
                  </p>
                </article>
              );
            })
          ))}

        {subTab === "confirmed" &&
          (confirmedBookings.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-sm text-neutral-500">
              No confirmed games yet. Accept an organizer invite to add games to your schedule.
            </p>
          ) : (
            confirmedBookings.map((booking) => {
              const ev = eventFromJoin(booking.scheduled_events);
              return (
                <article key={booking.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Confirmed</p>
                  <p className="mt-1 text-lg font-semibold text-neutral-900">{ev?.title ?? "Game"}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {ev?.sport}
                    {ev?.starts_at ? ` · ${new Date(ev.starts_at).toLocaleString()}` : ""}
                  </p>
                </article>
              );
            })
          ))}
      </div>
    </section>
  );
}
