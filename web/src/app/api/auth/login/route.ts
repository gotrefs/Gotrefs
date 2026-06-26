import { NextResponse, type NextRequest } from "next/server";
import { confirmUserEmail, findUserByEmail } from "@/lib/auth/admin-users";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { dashboardPathForRole } from "@/lib/member-role";
import { validateEmail } from "@/lib/auth/validation";
import { serverEnv } from "@/lib/env/server";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

type LoginBody = {
  email?: string;
  password?: string;
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

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const emailErr = validateEmail(email);
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("email not confirmed")) {
      try {
        const admin = createServiceClient();
        const authUser = await findUserByEmail(admin, email);
        if (authUser) {
          await confirmUserEmail(admin, authUser.id);
          const retry = await supabase.auth.signInWithPassword({ email, password });
          data = retry.data;
          error = retry.error;
        }
      } catch {
        return NextResponse.json(
          {
            error:
              "This account is not confirmed yet, and auto-confirm is not configured. Add SUPABASE_SERVICE_ROLE_KEY locally.",
          },
          { status: 503 }
        );
      }
      if (error) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
  }

  let role: "ref" | "organizer" = "ref";
  try {
    const admin = createServiceClient();
    if (data.user) {
      const sync = await syncMemberAccount(admin, data.user);
      role = sync.role;
    }
  } catch {
    role = data.user?.user_metadata?.role === "organizer" ? "organizer" : "ref";
  }

  return jsonWithSessionCookies(sessionResponse, {
    ok: true,
    userId: data.user?.id ?? null,
    role,
    redirect: dashboardPathForRole(role),
  });
}
