import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

export type OAuthProvider = "google" | "facebook" | "apple";

type AppleIdentity = {
  name?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

function providerFromPath(value: string): OAuthProvider | null {
  if (value === "google" || value === "facebook" || value === "apple") return value;
  return null;
}

export function parseOAuthProvider(value: string): OAuthProvider {
  const provider = providerFromPath(value);
  if (!provider) throw new Error("Unsupported OAuth provider.");
  return provider;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function parseAppleIdentity(raw: string | null): AppleIdentity | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppleIdentity;
  } catch {
    return null;
  }
}

function oauthProfileFromUser(
  user: User,
  provider: OAuthProvider,
  appleIdentity?: AppleIdentity | null
) {
  const meta = user.user_metadata ?? {};
  const email = user.email?.trim().toLowerCase() ?? "";
  const emailName = email ? email.split("@")[0] : "User";
  const appleFirst = clean(appleIdentity?.name?.firstName);
  const appleLast = clean(appleIdentity?.name?.lastName);
  const metaFullName = clean(meta.full_name) || clean(meta.name);
  const split = splitName(metaFullName);

  const firstName = clean(meta.first_name) || appleFirst || split.firstName || emailName;
  const lastName = clean(meta.last_name) || appleLast || split.lastName;
  const displayName =
    `${firstName} ${lastName}`.trim() || metaFullName || emailName;

  return {
    email,
    firstName,
    lastName,
    displayName,
    profilePicture:
      clean(meta.avatar_url) ||
      clean(meta.picture) ||
      clean(meta.profile_picture) ||
      null,
    provider,
  };
}

export async function upsertOAuthMember(
  admin: SupabaseClient,
  user: User,
  provider: OAuthProvider,
  appleIdentity?: AppleIdentity | null
) {
  const profile = oauthProfileFromUser(user, provider, appleIdentity);
  const now = new Date().toISOString();

  const { data: byId } = await admin
    .from("members")
    .select("id, is_onboarded, role")
    .eq("id", user.id)
    .maybeSingle();

  if (byId) {
    const { error } = await admin
      .from("members")
      .update({
        email: profile.email || null,
        profile_picture_url: profile.profilePicture,
        auth_provider: provider,
        last_login_at: now,
      })
      .eq("id", user.id);
    if (error) throw new Error(error.message);
    return { ...profile, isOnboarded: Boolean(byId.is_onboarded), role: byId.role ?? null };
  }

  const { data: byEmail } = profile.email
    ? await admin
        .from("members")
        .select("id, is_onboarded, role")
        .ilike("email", profile.email)
        .maybeSingle()
    : { data: null };

  if (byEmail?.id === user.id) {
    const { error } = await admin
      .from("members")
      .update({
        profile_picture_url: profile.profilePicture,
        auth_provider: provider,
        last_login_at: now,
      })
      .eq("id", user.id);
    if (error) throw new Error(error.message);
    return { ...profile, isOnboarded: Boolean(byEmail.is_onboarded), role: byEmail.role ?? null };
  }

  const { error } = await admin.from("members").insert({
    id: user.id,
    role: "ref",
    display_name: profile.displayName,
    first_name: profile.firstName || null,
    last_name: profile.lastName || null,
    email: profile.email || null,
    profile_picture_url: profile.profilePicture,
    auth_provider: provider,
    is_onboarded: false,
    last_login_at: now,
  });
  if (error) throw new Error(error.message);

  await admin.from("ref_profiles").upsert({ member_id: user.id }, { onConflict: "member_id" });
  await admin.from("screening_checks").upsert({ ref_member_id: user.id }, { onConflict: "ref_member_id" });

  return { ...profile, isOnboarded: false, role: "ref" };
}

export async function handleOAuthCallback(
  request: NextRequest,
  provider: OAuthProvider,
  appleUserPayload?: string | null
) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";
  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=oauth_missing_code", requestUrl.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=oauth_failed&reason=${encodeURIComponent(error.message)}`, requestUrl.origin)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/auth/login?error=oauth_missing_user", requestUrl.origin));
  }

  const admin = createServiceClient();
  const appleIdentity = provider === "apple" ? parseAppleIdentity(appleUserPayload ?? null) : null;
  const member = await upsertOAuthMember(admin, user, provider, appleIdentity);

  const destination = new URL(next.startsWith("/") ? next : "/dashboard", requestUrl.origin);
  destination.searchParams.set("isOnboarded", String(member.isOnboarded));

  const redirect = NextResponse.redirect(destination);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirect;
}
