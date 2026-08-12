import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatorAssuranceLevel } from "@/lib/auth/mfa";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const aal = await getAuthenticatorAssuranceLevel();
  const totp = (factors?.totp ?? []).map((f) => ({
    id: f.id,
    friendly_name: f.friendly_name,
    status: f.status,
  }));

  return NextResponse.json({
    factors: totp,
    currentLevel: aal.currentLevel,
    nextLevel: aal.nextLevel,
    enrolled: totp.some((f) => f.status === "verified"),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    action?: "enroll" | "verify_enrollment" | "challenge" | "verify_challenge" | "unenroll";
    factorId?: string;
    code?: string;
    challengeId?: string;
    friendlyName?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "action is required." }, { status: 400 });
  }

  if (action === "enroll") {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: body.friendlyName?.trim() || "Authenticator app",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    });
  }

  if (action === "verify_enrollment") {
    if (!body.factorId || !body.code) {
      return NextResponse.json({ error: "factorId and code are required." }, { status: 400 });
    }
    const challenge = await supabase.auth.mfa.challenge({ factorId: body.factorId });
    if (challenge.error) {
      return NextResponse.json({ error: challenge.error.message }, { status: 400 });
    }
    const verified = await supabase.auth.mfa.verify({
      factorId: body.factorId,
      challengeId: challenge.data.id,
      code: body.code.trim(),
    });
    if (verified.error) {
      return NextResponse.json({ error: verified.error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, enrolled: true });
  }

  if (action === "challenge") {
    if (!body.factorId) {
      return NextResponse.json({ error: "factorId is required." }, { status: 400 });
    }
    const challenge = await supabase.auth.mfa.challenge({ factorId: body.factorId });
    if (challenge.error) {
      return NextResponse.json({ error: challenge.error.message }, { status: 400 });
    }
    return NextResponse.json({ challengeId: challenge.data.id, expiresAt: challenge.data.expires_at });
  }

  if (action === "verify_challenge") {
    if (!body.factorId || !body.challengeId || !body.code) {
      return NextResponse.json(
        { error: "factorId, challengeId, and code are required." },
        { status: 400 }
      );
    }
    const verified = await supabase.auth.mfa.verify({
      factorId: body.factorId,
      challengeId: body.challengeId,
      code: body.code.trim(),
    });
    if (verified.error) {
      return NextResponse.json({ error: verified.error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, aal: "aal2" });
  }

  if (action === "unenroll") {
    if (!body.factorId) {
      return NextResponse.json({ error: "factorId is required." }, { status: 400 });
    }
    const { error } = await supabase.auth.mfa.unenroll({ factorId: body.factorId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
