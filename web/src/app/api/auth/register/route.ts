import { NextResponse, type NextRequest } from "next/server";
import { confirmUserEmail, findUserByEmail } from "@/lib/auth/admin-users";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { dashboardPathForRole } from "@/lib/member-role";
import { validatePasswordStrength } from "@/lib/auth/password";
import { validateEmail, validateName } from "@/lib/auth/validation";
import { serverEnv } from "@/lib/env/server";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

type RegisterBody = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: "ref" | "organizer";
  organizationName?: string;
};

export async function POST(request: NextRequest) {
  try {
    serverEnv.supabaseUrl();
    serverEnv.supabaseAnonKey();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured. Set Supabase env vars in .env.local." },
      { status: 503 }
    );
  }

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const role = body.role === "organizer" ? "organizer" : "ref";
  const organizationName = (body.organizationName ?? "").trim();

  const emailErr = validateEmail(email);
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

  const fnErr = validateName(firstName, "First name");
  if (fnErr) return NextResponse.json({ error: fnErr }, { status: 400 });

  const lnErr = validateName(lastName, "Last name");
  if (lnErr) return NextResponse.json({ error: lnErr }, { status: 400 });

  const pwErr = validatePasswordStrength(password);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

  if (role === "organizer" && !organizationName) {
    return NextResponse.json({ error: "Organization name is required for organizers." }, { status: 400 });
  }

  const userMetadata = {
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    organization_name: role === "organizer" ? organizationName : null,
    role,
  };

  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    admin = null;
  }

  if (admin) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    let authUser = created.user;

    if (createErr) {
      const msg = createErr.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        authUser = await findUserByEmail(admin, email);
        if (!authUser) {
          return NextResponse.json({ error: createErr.message }, { status: 400 });
        }
        await admin.auth.admin.updateUserById(authUser.id, {
          user_metadata: userMetadata,
          password,
        });
        await confirmUserEmail(admin, authUser.id);
      } else {
        return NextResponse.json({ error: createErr.message }, { status: 400 });
      }
    }

    if (authUser) {
      await syncMemberAccount(admin, authUser);
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      return NextResponse.json({ error: signInErr.message }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const sync = user ? await syncMemberAccount(admin, user) : { ok: true, role: role as "ref" | "organizer" };

    return jsonWithSessionCookies(sessionResponse, {
      ok: true,
      needsEmailConfirmation: false,
      role: sync.role,
      redirect: dashboardPathForRole(sync.role),
    });
  }

  const siteUrl = serverEnv.siteUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: userMetadata,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const payload = {
    ok: true,
    needsEmailConfirmation: !data.session,
    userId: data.user?.id ?? null,
    role,
    redirect: dashboardPathForRole(role),
  };

  if (data.session) {
    return jsonWithSessionCookies(sessionResponse, payload);
  }

  return NextResponse.json(payload);
}
