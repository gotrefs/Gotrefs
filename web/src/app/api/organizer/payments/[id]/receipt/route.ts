import { NextResponse, type NextRequest } from "next/server";
import { isOrganizerMember } from "@/lib/organizer-access";
import { loadOrganizerPayments, receiptToHtml } from "@/lib/stripe/organizer-receipts";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  try {
    const payments = await loadOrganizerPayments(admin, user.id, { paymentId: id });
    const payment = payments[0];
    if (!payment) {
      return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
    }

    const format = request.nextUrl.searchParams.get("format");
    if (format === "html") {
      return new NextResponse(receiptToHtml(payment), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="gotrefs-receipt-${payment.id}.html"`,
        },
      });
    }

    return NextResponse.json({
      brand: "GotREFS",
      documentType: "organizer_expense_receipt",
      note: "Expense receipt for organizer tax records. Not a 1099.",
      receipt: payment,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load receipt.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
