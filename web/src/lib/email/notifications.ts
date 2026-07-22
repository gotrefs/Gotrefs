import type { SupabaseClient } from "@supabase/supabase-js";
import { BRAND_NAME } from "@/lib/brand";
import { emailLayout, escapeHtml } from "@/lib/email/layout";
import { emailSiteUrl, sendEmail } from "@/lib/email/resend";

async function emailForMemberId(
  admin: SupabaseClient,
  memberId: string
): Promise<{ email: string; displayName: string } | null> {
  const [{ data: auth }, { data: member }] = await Promise.all([
    admin.auth.admin.getUserById(memberId),
    admin.from("members").select("display_name").eq("id", memberId).maybeSingle(),
  ]);
  const email = auth.user?.email?.trim().toLowerCase();
  if (!email) return null;
  const displayName =
    member?.display_name?.trim() ||
    String(auth.user?.user_metadata?.full_name ?? "").trim() ||
    email.split("@")[0];
  return { email, displayName };
}

async function eventSummary(
  admin: SupabaseClient,
  eventId: string
): Promise<{
  title: string;
  sport: string;
  startsAt: string;
  place: string;
  address: string;
  notes: string;
  organizerName: string;
} | null> {
  let { data: event, error } = await admin
    .from("scheduled_events")
    .select(
      "title, sport, starts_at, city, state, zip_code, venue_street, venue_unit, notes, organizer_member_id"
    )
    .eq("id", eventId)
    .maybeSingle();
  if (error && (error.message.includes("venue_street") || error.message.includes("venue_unit"))) {
    const fallback = await admin
      .from("scheduled_events")
      .select("title, sport, starts_at, city, state, zip_code, notes, organizer_member_id")
      .eq("id", eventId)
      .maybeSingle();
    event = fallback.data as typeof event;
  }
  if (!event) return null;
  const { data: org } = await admin
    .from("members")
    .select("display_name")
    .eq("id", event.organizer_member_id)
    .maybeSingle();
  const place = [event.city, event.state].filter(Boolean).join(", ") || event.zip_code || "TBD";
  const street = [
    (event as { venue_street?: string | null }).venue_street,
    (event as { venue_unit?: string | null }).venue_unit,
  ]
    .filter(Boolean)
    .join(", ");
  const address = [street, place, event.zip_code && street ? event.zip_code : null]
    .filter(Boolean)
    .join(", ");
  return {
    title: event.title || "Event",
    sport: event.sport || "Sport",
    startsAt: event.starts_at
      ? new Date(event.starts_at).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "TBD",
    place,
    address: address || place,
    notes: sanitizeOrganizerNotesForRef(event.notes),
    organizerName: org?.display_name?.trim() || "an organizer",
  };
}

/** Strip email/phone from organizer notes shown to confirmed refs. */
function sanitizeOrganizerNotesForRef(notes: string | null | undefined): string {
  if (!notes?.trim()) return "";
  return notes
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (/^contact:/i.test(part)) return "";
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(part)) return "";
      if (/^(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}$/.test(part.replace(/\s/g, ""))) return "";
      return part
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "")
        .replace(/(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/^[\s,;:·-]+|[\s,;:·-]+$/g, "")
        .trim();
    })
    .filter(Boolean)
    .join(" · ");
}

function dashboardUrl(siteUrl: string, path: "/dashboard/referee" | "/dashboard/organizer") {
  return `${siteUrl.replace(/\/$/, "")}${path}`;
}

async function gotrefsIdForMember(admin: SupabaseClient, memberId: string): Promise<string> {
  const { data: profile } = await admin
    .from("ref_profiles")
    .select("gotrefs_id")
    .eq("member_id", memberId)
    .maybeSingle();
  if (profile?.gotrefs_id?.trim()) return profile.gotrefs_id.trim();
  const { data: authUser } = await admin.auth.admin.getUserById(memberId);
  if (typeof authUser?.user?.user_metadata?.gotrefs_id === "string") {
    return authUser.user.user_metadata.gotrefs_id;
  }
  return `GR-${memberId.slice(0, 8).toUpperCase()}`;
}

/** Fire-and-forget wrapper so API routes never block on email. */
export function notifyInBackground(task: () => Promise<unknown>) {
  void task().catch((error) => {
    console.error("[email] notification failed:", error);
  });
}

export async function notifyOfferInvite(opts: {
  admin: SupabaseClient;
  refMemberId: string;
  eventId: string;
  message?: string | null;
  offeredPay?: number | null;
  siteUrl?: string;
}) {
  const siteUrl = opts.siteUrl || emailSiteUrl();
  const [ref, event] = await Promise.all([
    emailForMemberId(opts.admin, opts.refMemberId),
    eventSummary(opts.admin, opts.eventId),
  ]);
  if (!ref || !event) return false;

  const pay =
    opts.offeredPay != null && Number.isFinite(Number(opts.offeredPay))
      ? `$${Number(opts.offeredPay).toFixed(2)}`
      : "See offer details";
  const note = opts.message?.trim()
    ? `<p><strong>Message from organizer:</strong> ${escapeHtml(opts.message.trim())}</p>`
    : "";

  return sendEmail({
    to: ref.email,
    subject: `${BRAND_NAME}: New game invite — ${event.title}`,
    html: emailLayout({
      title: "An organizer wants you to ref",
      bodyHtml: `
        <p>Hi ${escapeHtml(ref.displayName)},</p>
        <p>An event organizer invited you to officiate:</p>
        <ul>
          <li><strong>${escapeHtml(event.title)}</strong></li>
          <li>${escapeHtml(event.sport)} · ${escapeHtml(event.startsAt)}</li>
          <li>${escapeHtml(event.place)}</li>
          <li>Offered pay: ${escapeHtml(pay)}</li>
        </ul>
        ${note}
        <p>Open your dashboard to accept or decline. Names, emails, and phone numbers are never shared.</p>
      `,
      ctaLabel: "Open referee dashboard",
      ctaUrl: dashboardUrl(siteUrl, "/dashboard/referee"),
    }),
  });
}

export async function notifyApplicationDecision(opts: {
  admin: SupabaseClient;
  refMemberId: string;
  eventId: string;
  accepted: boolean;
  applicationId?: string | null;
  siteUrl?: string;
}) {
  const siteUrl = opts.siteUrl || emailSiteUrl();
  const [ref, event] = await Promise.all([
    emailForMemberId(opts.admin, opts.refMemberId),
    eventSummary(opts.admin, opts.eventId),
  ]);
  if (!ref || !event) return false;

  const decisionParam = opts.applicationId
    ? `decision=${encodeURIComponent(opts.applicationId)}&outcome=${opts.accepted ? "accepted" : "declined"}`
    : `outcome=${opts.accepted ? "accepted" : "declined"}`;
  const decisionUrl = `${dashboardUrl(siteUrl, "/dashboard/referee")}?${decisionParam}`;

  if (opts.accepted) {
    const notesBlock = event.notes
      ? `<p><strong>Notes:</strong> ${escapeHtml(event.notes)}</p>`
      : "";
    return sendEmail({
      to: ref.email,
      subject: `${BRAND_NAME}: You've been confirmed for ${event.title}`,
      html: emailLayout({
        title: "You're confirmed",
        bodyHtml: `
          <p>Hi ${escapeHtml(ref.displayName)},</p>
          <p>You've been confirmed for <strong>${escapeHtml(event.title)}</strong>.</p>
          <ul>
            <li><strong>When:</strong> ${escapeHtml(event.sport)} · ${escapeHtml(event.startsAt)}</li>
            <li><strong>Address:</strong> ${escapeHtml(event.address)}</li>
          </ul>
          ${notesBlock}
          <p>These details are also saved under Upcoming games in your dashboard. Organizer names, emails, and phone numbers are never shared.</p>
        `,
        ctaLabel: "View your approval",
        ctaUrl: decisionUrl,
      }),
    });
  }

  return sendEmail({
    to: ref.email,
    subject: `${BRAND_NAME}: Update on ${event.title}`,
    html: emailLayout({
      title: "Not this time",
      bodyHtml: `
        <p>Hi ${escapeHtml(ref.displayName)},</p>
        <p>No worries — you weren’t selected for <strong>${escapeHtml(event.title)}</strong> (${escapeHtml(event.place)} · ${escapeHtml(event.startsAt)}) this time.</p>
        <p>You can check out more events on your dashboard and keep requesting games that fit your schedule.</p>
      `,
      ctaLabel: "View decision details",
      ctaUrl: decisionUrl,
    }),
  });
}

export async function notifyOfferResponseToOrganizer(opts: {
  admin: SupabaseClient;
  organizerMemberId: string;
  refMemberId: string;
  eventId: string;
  accepted: boolean;
  siteUrl?: string;
}) {
  const siteUrl = opts.siteUrl || emailSiteUrl();
  const [org, event, refId] = await Promise.all([
    emailForMemberId(opts.admin, opts.organizerMemberId),
    eventSummary(opts.admin, opts.eventId),
    gotrefsIdForMember(opts.admin, opts.refMemberId),
  ]);
  if (!org || !event) return false;

  return sendEmail({
    to: org.email,
    subject: opts.accepted
      ? `${BRAND_NAME}: Ref ${refId} accepted your offer`
      : `${BRAND_NAME}: Ref ${refId} declined your offer`,
    html: emailLayout({
      title: opts.accepted ? "Offer accepted" : "Offer declined",
      bodyHtml: `
        <p>Hi ${escapeHtml(org.displayName)},</p>
        <p><strong>Ref ${escapeHtml(refId)}</strong> ${opts.accepted ? "accepted" : "declined"} your offer for:</p>
        <ul>
          <li><strong>${escapeHtml(event.title)}</strong></li>
          <li>${escapeHtml(event.sport)} · ${escapeHtml(event.startsAt)}</li>
        </ul>
        <p>${opts.accepted ? "Your booking is confirmed in GotREFS." : "You can invite another verified official from your dashboard."}</p>
      `,
      ctaLabel: "Open organizer dashboard",
      ctaUrl: dashboardUrl(siteUrl, "/dashboard/organizer"),
    }),
  });
}

export async function notifyOfferCanceledToRef(opts: {
  admin: SupabaseClient;
  refMemberId: string;
  eventId: string;
  siteUrl?: string;
}) {
  const siteUrl = opts.siteUrl || emailSiteUrl();
  const [ref, event] = await Promise.all([
    emailForMemberId(opts.admin, opts.refMemberId),
    eventSummary(opts.admin, opts.eventId),
  ]);
  if (!ref || !event) return false;

  return sendEmail({
    to: ref.email,
    subject: `${BRAND_NAME}: Offer canceled — ${event.title}`,
    html: emailLayout({
      title: "Offer canceled",
      bodyHtml: `
        <p>Hi ${escapeHtml(ref.displayName)},</p>
        <p>The organizer canceled the offer for <strong>${escapeHtml(event.title)}</strong> (${escapeHtml(event.sport)} · ${escapeHtml(event.startsAt)}).</p>
        <p>Find other open games on your dashboard.</p>
      `,
      ctaLabel: "Find games now",
      ctaUrl: dashboardUrl(siteUrl, "/dashboard/referee"),
    }),
  });
}

export async function notifyOrganizerNewApplication(opts: {
  admin: SupabaseClient;
  eventId: string;
  refMemberId: string;
  applicationId?: string | null;
  siteUrl?: string;
}) {
  const siteUrl = opts.siteUrl || emailSiteUrl();
  const event = await eventSummary(opts.admin, opts.eventId);
  if (!event) return false;

  const { data: scheduled } = await opts.admin
    .from("scheduled_events")
    .select("organizer_member_id")
    .eq("id", opts.eventId)
    .maybeSingle();
  if (!scheduled?.organizer_member_id) return false;

  const [org] = await Promise.all([
    emailForMemberId(opts.admin, scheduled.organizer_member_id),
  ]);
  if (!org) return false;

  const gotrefsId = await gotrefsIdForMember(opts.admin, opts.refMemberId);

  const reviewUrl = opts.applicationId
    ? `${dashboardUrl(siteUrl, "/dashboard/organizer")}?request=${encodeURIComponent(opts.applicationId)}`
    : `${dashboardUrl(siteUrl, "/dashboard/organizer")}?panel=requests`;

  return sendEmail({
    to: org.email,
    subject: `Ref Requested For ${event.title} (${event.place} · ${event.startsAt})`,
    html: emailLayout({
      title: "Ref requested for your event",
      bodyHtml: `
        <p>Hi ${escapeHtml(org.displayName)},</p>
        <p><strong>Ref ${escapeHtml(gotrefsId)}</strong> requested to officiate:</p>
        <ul>
          <li><strong>${escapeHtml(event.title)}</strong></li>
          <li>${escapeHtml(event.place)}</li>
          <li>${escapeHtml(event.sport)} · ${escapeHtml(event.startsAt)}</li>
        </ul>
        <p>Review their GotREFS ID card, ratings, and price — then approve or deny. Names, emails, and phone numbers are never shared.</p>
      `,
      ctaLabel: "Review this request",
      ctaUrl: reviewUrl,
    }),
  });
}

export async function notifyProfileSubmitted(opts: {
  admin: SupabaseClient;
  refMemberId: string;
  siteUrl?: string;
}) {
  const siteUrl = opts.siteUrl || emailSiteUrl();
  const ref = await emailForMemberId(opts.admin, opts.refMemberId);
  if (!ref) return false;

  return sendEmail({
    to: ref.email,
    subject: `${BRAND_NAME}: Profile received — review in progress`,
    html: emailLayout({
      title: "Thanks for finishing your profile",
      bodyHtml: `
        <p>Hi ${escapeHtml(ref.displayName)},</p>
        <p>We received your ${BRAND_NAME} verification package. Our team typically reviews submissions within 1–2 business days.</p>
        <p>We’ll email you as soon as you’re approved so you can start finding games.</p>
      `,
      ctaLabel: "View your dashboard",
      ctaUrl: dashboardUrl(siteUrl, "/dashboard/referee"),
    }),
  });
}

export async function notifyVerificationDecision(opts: {
  admin: SupabaseClient;
  refMemberId: string;
  approved: boolean;
  adminNotes?: string | null;
  siteUrl?: string;
}) {
  const siteUrl = opts.siteUrl || emailSiteUrl();
  const ref = await emailForMemberId(opts.admin, opts.refMemberId);
  if (!ref) return false;

  if (opts.approved) {
    return sendEmail({
      to: ref.email,
      subject: `${BRAND_NAME}: You're approved — find games now`,
      html: emailLayout({
        title: "You've been accepted",
        bodyHtml: `
          <p>Hi ${escapeHtml(ref.displayName)},</p>
          <p>Your ${BRAND_NAME} account is approved. You can now request games and receive invites from organizers.</p>
          <p>Open your referee dashboard to find games near you.</p>
        `,
        ctaLabel: "Find games now",
        ctaUrl: dashboardUrl(siteUrl, "/dashboard/referee"),
      }),
    });
  }

  const notes = opts.adminNotes?.trim()
    ? `<p><strong>What to fix:</strong> ${escapeHtml(opts.adminNotes.trim())}</p>`
    : "";

  return sendEmail({
    to: ref.email,
    subject: `${BRAND_NAME}: Verification needs updates`,
    html: emailLayout({
      title: "Verification not approved yet",
      bodyHtml: `
        <p>Hi ${escapeHtml(ref.displayName)},</p>
        <p>Your verification needs a few updates before we can approve your account.</p>
        ${notes}
        <p>Sign in to review the feedback and resubmit.</p>
      `,
      ctaLabel: "Open referee dashboard",
      ctaUrl: dashboardUrl(siteUrl, "/dashboard/referee"),
    }),
  });
}
