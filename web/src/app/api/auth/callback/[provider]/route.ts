import { type NextRequest } from "next/server";
import { handleOAuthCallback, parseOAuthProvider } from "@/lib/auth/oauth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await context.params;
  return handleOAuthCallback(request, parseOAuthProvider(rawProvider));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await context.params;
  const provider = parseOAuthProvider(rawProvider);
  const form = await request.formData();
  const appleUser = typeof form.get("user") === "string" ? String(form.get("user")) : null;
  return handleOAuthCallback(request, provider, appleUser);
}
