import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { dashboardPathForRole } from "@/lib/member-role";
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

function missingColumnName(error: { message?: string } | null) {
  const message = error?.message ?? "";
  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];
  const postgresMatch = message.match(/column\s+(?:\w+\.)?(\w+)\s+does not exist/i);
  return postgresMatch?.[1] ?? null;
}

async function updateMemberWithOptionalColumns(
  admin: SupabaseClient,
  userId: string,
  values: Record<string, unknown>
) {
  const payload = { ...values };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await admin.from("members").update(payload).eq("id", userId);
    if (!error) return;
    const column = missingColumnName(error);
    if (!column || !(column in payload)) throw new Error(error.message);
    delete payload[column];
  }
  throw new Error("Could not update OAuth member metadata.");
}

async function insertMemberWithOptionalColumns(
  admin: SupabaseClient,
  values: Record<string, unknown>
) {
  const payload = { ...values };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await admin.from("members").insert(payload);
    if (!error) return;
    if (error.message.includes("duplicate key value") && typeof payload.id === "string") {
      const { id, ...updatePayload } = payload;
      await updateMemberWithOptionalColumns(admin, id, updatePayload);
      return;
    }
    const column = missingColumnName(error);
    if (!column || !(column in payload)) throw new Error(error.message);
    delete payload[column];
  }
  throw new Error("Could not create OAuth member.");
}

async function findMemberByEmail(admin: SupabaseClient, email: string) {
  const { data, error } = await admin
    .from("members")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (missingColumnName(error) === "email") return null;
  if (error) throw new Error(error.message);
  return data;
}

async function updateMemberOAuthMetadata(
  admin: SupabaseClient,
  userId: string,
  profile: ReturnType<typeof oauthProfileFromUser>,
  provider: OAuthProvider,
  now: string,
  includeEmail: boolean
) {
  const update = {
    ...(includeEmail ? { email: profile.email || null } : {}),
    profile_picture_url: profile.profilePicture,
    auth_provider: provider,
    last_login_at: now,
  };

  await updateMemberWithOptionalColumns(admin, userId, update);
}

async function insertOAuthMember(
  admin: SupabaseClient,
  user: User,
  profile: ReturnType<typeof oauthProfileFromUser>,
  provider: OAuthProvider,
  now: string
) {
  const row = {
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
  };

  await insertMemberWithOptionalColumns(admin, row);
}

async function deleteTargetPlaceholders(admin: SupabaseClient, targetId: string) {
  await Promise.all([
    admin.from("ref_profiles").delete().eq("member_id", targetId),
    admin.from("screening_checks").delete().eq("ref_member_id", targetId),
    admin.from("organizer_profiles").delete().eq("member_id", targetId),
    admin.from("ref_verification_submissions").delete().eq("ref_member_id", targetId),
  ]);
}

async function reassignMemberReferences(admin: SupabaseClient, fromId: string, toId: string) {
  await deleteTargetPlaceholders(admin, toId);

  const updates = [
    admin.from("ref_profiles").update({ member_id: toId }).eq("member_id", fromId),
    admin.from("screening_checks").update({ ref_member_id: toId }).eq("ref_member_id", fromId),
    admin.from("ref_availability").update({ ref_member_id: toId }).eq("ref_member_id", fromId),
    admin.from("scheduled_events").update({ organizer_member_id: toId }).eq("organizer_member_id", fromId),
    admin.from("assignment_offers").update({ ref_member_id: toId }).eq("ref_member_id", fromId),
    admin.from("bookings").update({ ref_member_id: toId }).eq("ref_member_id", fromId),
    admin.from("bookings").update({ organizer_member_id: toId }).eq("organizer_member_id", fromId),
    admin.from("event_signup_requests").update({ ref_member_id: toId }).eq("ref_member_id", fromId),
    admin.from("ref_verification_submissions").update({ ref_member_id: toId }).eq("ref_member_id", fromId),
    admin.from("organizer_profiles").update({ member_id: toId }).eq("member_id", fromId),
    admin.from("ref_ratings").update({ ref_member_id: toId }).eq("ref_member_id", fromId),
    admin.from("ref_ratings").update({ organizer_member_id: toId }).eq("organizer_member_id", fromId),
    admin.from("assignor_roster_entries").update({ assignor_member_id: toId }).eq("assignor_member_id", fromId),
    admin.from("ref_inquiries").update({ ref_member_id: toId }).eq("ref_member_id", fromId),
    admin.from("ref_inquiries").update({ organizer_member_id: toId }).eq("organizer_member_id", fromId),
  ];

  const results = await Promise.all(updates);
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(error.message);
}

async function mergeExistingEmailMember(
  admin: SupabaseClient,
  existingMember: Record<string, unknown>,
  user: User,
  profile: ReturnType<typeof oauthProfileFromUser>,
  provider: OAuthProvider,
  now: string
) {
  const fromId = String(existingMember.id ?? "");
  if (!fromId || fromId === user.id) return null;

  const memberData = { ...existingMember };
  delete memberData.id;
  const current = await admin.from("members").select("id").eq("id", user.id).maybeSingle();

  if (current.data) {
    await updateMemberWithOptionalColumns(admin, user.id, memberData);
  } else {
    await insertMemberWithOptionalColumns(admin, { ...memberData, id: user.id });
  }

  await reassignMemberReferences(admin, fromId, user.id);
  await admin.from("members").delete().eq("id", fromId);
  await updateMemberOAuthMetadata(admin, user.id, profile, provider, now, true);

  return {
    isOnboarded: Boolean(existingMember.is_onboarded),
    role: typeof existingMember.role === "string" ? existingMember.role : null,
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
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (byId) {
    await updateMemberOAuthMetadata(admin, user.id, profile, provider, now, true);
    return { ...profile, isOnboarded: false, role: byId.role ?? null };
  }

  const currentByEmail = profile.email ? await findMemberByEmail(admin, profile.email) : null;

  if (currentByEmail?.id === user.id) {
    await updateMemberOAuthMetadata(admin, user.id, profile, provider, now, false);
    return { ...profile, isOnboarded: Boolean(currentByEmail.is_onboarded), role: currentByEmail.role ?? null };
  }

  if (currentByEmail) {
    const merged = await mergeExistingEmailMember(admin, currentByEmail, user, profile, provider, now);
    if (merged) {
      return { ...profile, isOnboarded: merged.isOnboarded, role: merged.role };
    }
  }

  await insertOAuthMember(admin, user, profile, provider, now);

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

  try {
    const admin = createServiceClient();
    const appleIdentity = provider === "apple" ? parseAppleIdentity(appleUserPayload ?? null) : null;
    const member = await upsertOAuthMember(admin, user, provider, appleIdentity);

    const nextPath = next.startsWith("/") ? next : "/dashboard";
    const destination = new URL(
      nextPath === "/dashboard" && (member.role === "ref" || member.role === "organizer")
        ? dashboardPathForRole(member.role)
        : nextPath,
      requestUrl.origin
    );
    destination.searchParams.set("isOnboarded", String(member.isOnboarded));

    const redirect = NextResponse.redirect(destination);
    sessionResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirect;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "oauth_callback_failed";
    console.error("[auth/oauth] callback:", reason);
    const redirect = NextResponse.redirect(
      new URL(`/auth/login?error=oauth_failed&reason=${encodeURIComponent(reason)}`, requestUrl.origin)
    );
    sessionResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirect;
  }
}
