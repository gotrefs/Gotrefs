import type { SupabaseClient } from "@supabase/supabase-js";

export type VerificationDocKind = "gov_id_front" | "gov_id_back" | "certification" | "profile_photo";

export type VerificationDocFile = {
  kind: VerificationDocKind;
  path: string;
  name: string;
  updatedAt: string | null;
};

const KIND_PREFIXES: Array<{ kind: VerificationDocKind; prefix: string }> = [
  { kind: "gov_id_front", prefix: "gov_id_front_" },
  { kind: "gov_id_back", prefix: "gov_id_back_" },
  { kind: "certification", prefix: "certification_" },
  { kind: "profile_photo", prefix: "profile_photo_" },
];

/**
 * List the newest verification documents in a member's private storage folder.
 * Used so admins always see the latest uploads even if DB paths lag.
 */
export async function listLatestVerificationDocs(
  supabase: SupabaseClient,
  memberId: string
): Promise<VerificationDocFile[]> {
  const { data, error } = await supabase.storage.from("verification_documents").list(memberId, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error || !data?.length) return [];

  const latestByKind = new Map<VerificationDocKind, VerificationDocFile>();
  for (const item of data) {
    const name = item.name ?? "";
    const lower = name.toLowerCase();
    const matched = KIND_PREFIXES.find(({ prefix }) => lower.startsWith(prefix));
    if (!matched) continue;
    if (latestByKind.has(matched.kind)) continue;
    latestByKind.set(matched.kind, {
      kind: matched.kind,
      path: `${memberId}/${name}`,
      name,
      updatedAt: item.updated_at ?? item.created_at ?? null,
    });
  }

  return KIND_PREFIXES.map(({ kind }) => latestByKind.get(kind)).filter(
    (file): file is VerificationDocFile => Boolean(file)
  );
}

export function preferLatestDocPath(
  storedPath: string | null | undefined,
  latest: VerificationDocFile | undefined
): string | null {
  if (latest?.path) return latest.path;
  const current = (storedPath ?? "").trim();
  return current || null;
}
