import crypto from "crypto";

const CHECKR_BASE = "https://api.checkr.com/v1";

function basicAuthHeader(apiKey: string) {
  const token = Buffer.from(`${apiKey}:`, "utf8").toString("base64");
  return `Basic ${token}`;
}

export type StartScreeningInput = {
  refMemberId: string;
  email: string;
  fullName: string;
  zip?: string | null;
};

/** Create Checkr candidate + invitation when API key is configured. */
export async function startCheckrScreening(input: StartScreeningInput): Promise<{
  ok: boolean;
  skipped?: boolean;
  externalCandidateId?: string;
  error?: string;
}> {
  const apiKey = process.env.CHECKR_API_KEY?.trim();
  const pkg = process.env.CHECKR_PACKAGE_SLUG?.trim() || "tasker_standard";

  if (!apiKey) {
    return { ok: false, skipped: true };
  }

  const [givenName, ...rest] = input.fullName.trim().split(/\s+/);
  const familyName = rest.join(" ") || givenName;

  try {
    const candRes = await fetch(`${CHECKR_BASE}/candidates`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        first_name: givenName,
        last_name: familyName,
        custom_id: input.refMemberId,
        zipcode: input.zip || undefined,
      }),
    });

    if (!candRes.ok) {
      const t = await candRes.text();
      return { ok: false, error: `Checkr candidate: ${candRes.status} ${t}` };
    }

    const candidate = (await candRes.json()) as { id: string };

    const invRes = await fetch(`${CHECKR_BASE}/invitations`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        candidate_id: candidate.id,
        package: pkg,
        work_locations: [{ country: "US" }],
      }),
    });

    if (!invRes.ok) {
      const t = await invRes.text();
      return { ok: false, error: `Checkr invitation: ${invRes.status} ${t}` };
    }

    return { ok: true, externalCandidateId: candidate.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Checkr request failed" };
  }
}

/** Verify Checkr webhook signature (hex HMAC-SHA256 of raw body). */
export function verifyCheckrWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.replace(/^sha256=/, "").trim();
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

/** Map Checkr report adjudication to internal screening status. */
export function mapReportStatus(adjudication?: string | null): "clear" | "consider" | "pending" {
  const a = (adjudication || "").toLowerCase();
  if (a === "clear") return "clear";
  if (a === "suspended" || a === "canceled") return "consider";
  return "pending";
}
