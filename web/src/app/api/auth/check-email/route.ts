import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/auth/admin-users";
import { validateEmail } from "@/lib/auth/validation";
import { serverEnv } from "@/lib/env/server";
import { createServiceClient } from "@/lib/supabase/service";

type CheckEmailBody = {
  email?: string;
};

export async function POST(request: Request) {
  let admin;
  try {
    serverEnv.supabaseUrl();
    admin = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured for account lookup." },
      { status: 503 }
    );
  }

  let body: CheckEmailBody;
  try {
    body = (await request.json()) as CheckEmailBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const emailErr = validateEmail(email);
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

  const user = await findUserByEmail(admin, email);
  const appProviders = Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers.filter((provider): provider is string => typeof provider === "string")
    : [];
  const identityProviders =
    user?.identities
      ?.map((identity) => identity.provider)
      .filter((provider): provider is string => typeof provider === "string") ?? [];

  return NextResponse.json({
    exists: Boolean(user),
    providers: Array.from(new Set([...appProviders, ...identityProviders])),
  });
}
