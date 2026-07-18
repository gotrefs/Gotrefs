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
): Promise<{ title: string; sport: string; startsAt: string; organizerName: string } | null> {
  const { data: event } = await admin
    .from("scheduled_events")
    .select("title, sport, starts_at, organizer_member_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;
  const { data: org } = await admin
    .from("members")
    .select("display_name")
    .eq("id", event.organizer_member_id)
    .maybeSingle();
  return {
    title: event.title || "Event",
    sport: event.sport || "Sport",
    startsAt: event.starts_at
      ? new Date(event.starts_at).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "TBD",
    organizerName: org?.display_name?.trim() || "an organizer",
  };
}

function dashboardUrl(siteUrl: string, path: "/dashboard/referee" | "/dashboard/organizer") {
  return `${siteUrl.replace(/\/$/, "")}${path}`;
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
        <p><strong>${escapeHtml(event.organizerName)}</strong> invited you to officiate:</p>
        <ul>
          <li><strong>${escapeHtml(event.title)}</strong></li>
          <li>${escapeHtml(event.sport)} · ${escapeHtml(event.startsAt)}</li>
          <li>Offered pay: ${escapeHtml(pay)}</li>
        </ul>
        ${note}
        <p>Open your dashboard to accept or decline this offer.</p>
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
  siteUrl?: string;
}) {
  const siteUrl = opts.siteUrl || emailSiteUrl();
  const [ref, event] = await Promise.all([
    emailForMemberId(opts.admin, opts.refMemberId),
    eventSummary(opts.admin, opts.eventId),
  ]);
  if (!ref || !event) return false;

  if (opts.accepted) {
    return sendEmail({
      to: ref.email,
      subject: `${BRAND_NAME}: Your application was accepted — ${event.title}`,
      html: emailLayout({
        title: "You've been accepted",
        bodyHtml: `
          <p>Hi ${escapeHtml(ref.displayName)},</p>
          <p>Good news — <strong>${escapeHtml(event.organizerName)}</strong> accepted your request to ref:</p>
          <ul>
            <li><strong>${escapeHtml(event.title)}</strong></li>
            <li>${escapeHtml(event.sport)} · ${escapeHtml(event.startsAt)}</li>
          </ul>
          <p>Confirm the assignment in your dashboard when you’re ready.</p>
        `,
        ctaLabel: "Open referee dashboard",
        ctaUrl: dashboardUrl(siteUrl, "/dashboard/referee"),
      }),
    });
  }

  return sendEmail({
    to: ref.email,
    subject: `${BRAND_NAME}: Application update — ${event.title}`,
    html: emailLayout({
      title: "Application not selected",
      bodyHtml: `
        <p>Hi ${escapeHtml(ref.displayName)},</p>
        <p>Your request to officiate <strong>${escapeHtml(event.title)}</strong> (${escapeHtml(event.sport)} · ${escapeHtml(event.startsAt)}) was not accepted this time.</p>
        <p>Keep browsing open games — new opportunities are posted every day.</p>
      `,
      ctaLabel: "Find games now",
      ctaUrl: dashboardUrl(siteUrl, "/dashboard/referee"),
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
  const [org, ref, event] = await Promise.all([
    emailForMemberId(opts.admin, opts.organizerMemberId),
    emailForMemberId(opts.admin, opts.refMemberId),
    eventSummary(opts.admin, opts.eventId),
  ]);
  if (!org || !event) return false;
  const refName = ref?.displayName || "A referee";

  return sendEmail({
    to: org.email,
    subject: opts.accepted
      ? `${BRAND_NAME}: ${refName} accepted your offer`
      : `${BRAND_NAME}: ${refName} declined your offer`,
    html: emailLayout({
      title: opts.accepted ? "Offer accepted" : "Offer declined",
      bodyHtml: `
        <p>Hi ${escapeHtml(org.displayName)},</p>
        <p><strong>${escapeHtml(refName)}</strong> ${opts.accepted ? "accepted" : "declined"} your offer for:</p>
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

  const [org, ref] = await Promise.all([
    emailForMemberId(opts.admin, scheduled.organizer_member_id),
    emailForMemberId(opts.admin, opts.refMemberId),
  ]);
  if (!org) return false;
  const refName = ref?.displayName || "A referee";

  return sendEmail({
    to: org.email,
    subject: `${BRAND_NAME}: New ref request — ${event.title}`,
    html: emailLayout({
      title: "A referee wants this game",
      bodyHtml: `
        <p>Hi ${escapeHtml(org.displayName)},</p>
        <p><strong>${escapeHtml(refName)}</strong> requested to officiate:</p>
        <ul>
          <li><strong>${escapeHtml(event.title)}</strong></li>
          <li>${escapeHtml(event.sport)} · ${escapeHtml(event.startsAt)}</li>
        </ul>
        <p>Review applicants in your organizer dashboard to accept or decline.</p>
      `,
      ctaLabel: "Review applicants",
      ctaUrl: dashboardUrl(siteUrl, "/dashboard/organizer"),
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
