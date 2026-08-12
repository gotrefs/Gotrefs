import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/require-admin-api";
import { createServiceClient } from "@/lib/supabase/service";
import { taxYearForDate } from "@/lib/stripe/client";

/**
 * Admin YTD 1099 totals from the payouts ledger.
 * Stripe files/distributes 1099-NEC for Connect; this is GotRefs' audit export.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if ("error" in auth) return auth.error;

  const yearParam = request.nextUrl.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : taxYearForDate();
  if (!Number.isFinite(year) || year < 2000) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: rows, error } = await admin
    .from("payouts")
    .select("payee_member_id, gross_cents, status, tax_year, vendor_id")
    .eq("tax_year", year)
    .in("status", ["paid", "processing"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const byMember = new Map<
    string,
    { memberId: string; grossCents: number; payoutCount: number; vendorPayoutCents: number }
  >();

  for (const row of rows ?? []) {
    if (!row.payee_member_id) continue;
    const current = byMember.get(row.payee_member_id) ?? {
      memberId: row.payee_member_id,
      grossCents: 0,
      payoutCount: 0,
      vendorPayoutCents: 0,
    };
    current.grossCents += row.gross_cents;
    current.payoutCount += 1;
    if (row.vendor_id) current.vendorPayoutCents += row.gross_cents;
    byMember.set(row.payee_member_id, current);
  }

  const memberIds = [...byMember.keys()];
  const { data: members } = memberIds.length
    ? await admin.from("members").select("id, display_name, email").in("id", memberIds)
    : { data: [] as Array<{ id: string; display_name: string; email?: string | null }> };

  const { data: connects } = memberIds.length
    ? await admin
        .from("stripe_connect_accounts")
        .select("member_id, tax_id_provided, onboarding_complete, stripe_account_id")
        .in("member_id", memberIds)
    : { data: [] as Array<{
        member_id: string;
        tax_id_provided: boolean;
        onboarding_complete: boolean;
        stripe_account_id: string;
      }> };

  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));
  const connectMap = new Map((connects ?? []).map((c) => [c.member_id, c]));

  const report = [...byMember.values()]
    .map((row) => {
      const member = memberMap.get(row.memberId);
      const connect = connectMap.get(row.memberId);
      return {
        memberId: row.memberId,
        displayName: member?.display_name ?? "Unknown",
        email: (member as { email?: string | null } | undefined)?.email ?? null,
        grossCents: row.grossCents,
        grossDollars: row.grossCents / 100,
        payoutCount: row.payoutCount,
        vendorPayoutCents: row.vendorPayoutCents,
        taxIdProvided: Boolean(connect?.tax_id_provided),
        onboardingComplete: Boolean(connect?.onboarding_complete),
        stripeAccountId: connect?.stripe_account_id ?? null,
        meetsNecThreshold: row.grossCents >= 600_00,
      };
    })
    .sort((a, b) => b.grossCents - a.grossCents);

  return NextResponse.json({
    year,
    thresholdCents: 600_00,
    filingNote:
      "Stripe Tax Reporting for Connect files and distributes 1099-NEC. This export is GotRefs’ audit ledger.",
    totals: report,
  });
}
