import { NextResponse, type NextRequest } from "next/server";
import { isOrganizerMember } from "@/lib/organizer-access";
import {
  buildTaxSummary,
  loadOrganizerPayments,
  taxSummaryToCsv,
} from "@/lib/stripe/organizer-receipts";
import { taxYearForDate } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canView = await isOrganizerMember(supabase, user);
  if (!canView) {
    return NextResponse.json({ error: "Organizer access required." }, { status: 403 });
  }

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

  try {
    const payments = await loadOrganizerPayments(admin, user.id, { year });
    const summary = buildTaxSummary(payments, year);
    const format = request.nextUrl.searchParams.get("format");

    if (format === "csv") {
      const csv = taxSummaryToCsv(summary);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="gotrefs-organizer-tax-summary-${year}.csv"`,
        },
      });
    }

    return NextResponse.json({
      ...summary,
      note: "Year-end expense summary of amounts you paid through GotRefs. This is not a 1099.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not build tax summary.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
