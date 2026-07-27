import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFixRequiredSteps, type RefVerificationStepKey } from "@/lib/ref-verification-steps";

export type VerificationQueueEntry = {
  ref_member_id: string;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  resubmitted_at: string | null;
  admin_notes: string | null;
  fix_required_steps: RefVerificationStepKey[];
  created_at: string;
  updated_at: string;
  display_name: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  primary_sport: string | null;
  additional_sports: string[] | null;
  certification_level: string | null;
  government_id_path: string | null;
  government_id_back_path: string | null;
  certification_document_path: string | null;
  screening_status: string | null;
  screening_summary: string | null;
};

type MemberRow = {
  id: string;
  role: string;
  display_name: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at?: string | null;
};

type SubmissionRow = {
  ref_member_id: string;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  resubmitted_at?: string | null;
  admin_notes: string | null;
  fix_required_steps?: unknown;
  created_at: string;
  updated_at: string;
};

function missingColumn(error: { message?: string } | null, column: string) {
  return Boolean(error?.message?.includes(column));
}

function chunkIds<T>(items: T[], size = 100): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function loadAllRefMembers(admin: SupabaseClient) {
  const full = await admin
    .from("members")
    .select("id, role, display_name, email, first_name, last_name, created_at")
    .eq("role", "ref")
    .order("created_at", { ascending: false });

  if (!full.error) {
    return { data: (full.data as MemberRow[] | null) ?? [], error: null as { message?: string } | null };
  }

  if (missingColumn(full.error, "created_at")) {
    const withoutCreated = await admin
      .from("members")
      .select("id, role, display_name, email, first_name, last_name")
      .eq("role", "ref");
    return {
      data: (withoutCreated.data as MemberRow[] | null) ?? [],
      error: withoutCreated.error,
    };
  }

  if (
    missingColumn(full.error, "email") ||
    missingColumn(full.error, "first_name") ||
    missingColumn(full.error, "last_name")
  ) {
    const basic = await admin.from("members").select("id, role, display_name").eq("role", "ref");
    return { data: (basic.data as MemberRow[] | null) ?? [], error: basic.error };
  }

  return { data: [] as MemberRow[], error: full.error };
}

async function enrichMemberEmails(admin: SupabaseClient, members: MemberRow[]) {
  const emails = new Map<string, string>();
  await Promise.all(
    members.map(async (member) => {
      if (member.email?.trim()) {
        emails.set(member.id, member.email.trim());
        return;
      }
      const { data, error } = await admin.auth.admin.getUserById(member.id);
      if (!error && data.user?.email) {
        emails.set(member.id, data.user.email.trim().toLowerCase());
      }
    })
  );
  return emails;
}

async function loadSubmissions(
  admin: SupabaseClient,
  memberIds: string[]
): Promise<{ rows: SubmissionRow[]; error?: string }> {
  const rows: SubmissionRow[] = [];
  const selectFull =
    "ref_member_id, status, submitted_at, reviewed_at, resubmitted_at, admin_notes, fix_required_steps, created_at, updated_at";
  const selectBasic =
    "ref_member_id, status, submitted_at, reviewed_at, admin_notes, created_at, updated_at";

  for (const chunk of chunkIds(memberIds)) {
    let result = await admin.from("ref_verification_submissions").select(selectFull).in("ref_member_id", chunk);
    if (
      result.error &&
      (missingColumn(result.error, "fix_required_steps") || missingColumn(result.error, "resubmitted_at"))
    ) {
      result = await admin.from("ref_verification_submissions").select(selectBasic).in("ref_member_id", chunk) as typeof result;
    }
    if (result.error) {
      if (result.error.message.includes("ref_verification_submissions")) {
        return {
          rows: [],
          error:
            "The ref_verification_submissions table is missing. In Supabase → SQL Editor, run the full script in supabase/RUN_ADMIN_VERIFICATION_SETUP.sql.",
        };
      }
      return { rows: [], error: result.error.message };
    }
    rows.push(...(((result.data as SubmissionRow[] | null) ?? []) as SubmissionRow[]));
  }

  return { rows };
}

async function loadProfiles(admin: SupabaseClient, memberIds: string[]) {
  type ProfileRow = {
    member_id: string;
    primary_sport?: string | null;
    additional_sports?: string[] | null;
    certification_level?: string | null;
    government_id_path?: string | null;
    verification_doc_path?: string | null;
    certification_document_path?: string | null;
  };
  const rows: ProfileRow[] = [];
  const selectFull =
    "member_id, primary_sport, additional_sports, certification_level, government_id_path, verification_doc_path, certification_document_path";
  const selectBasic =
    "member_id, primary_sport, certification_level, government_id_path, verification_doc_path, certification_document_path";

  for (const chunk of chunkIds(memberIds)) {
    let result = await admin.from("ref_profiles").select(selectFull).in("member_id", chunk);
    if (result.error && missingColumn(result.error, "additional_sports")) {
      result = await admin.from("ref_profiles").select(selectBasic).in("member_id", chunk) as typeof result;
    }
    if (result.error) {
      console.error("[verification-queue] ref_profiles:", result.error.message);
      continue;
    }
    rows.push(...(((result.data as ProfileRow[] | null) ?? []) as ProfileRow[]));
  }
  return rows;
}

async function loadScreenings(admin: SupabaseClient, memberIds: string[]) {
  type ScreeningRow = { ref_member_id: string; status?: string | null; summary?: string | null };
  const rows: ScreeningRow[] = [];
  for (const chunk of chunkIds(memberIds)) {
    const result = await admin
      .from("screening_checks")
      .select("ref_member_id, status, summary")
      .in("ref_member_id", chunk);
    if (result.error) {
      console.error("[verification-queue] screening_checks:", result.error.message);
      continue;
    }
    rows.push(...((result.data as ScreeningRow[] | null) ?? []));
  }
  return rows;
}

/** Load every referee for admin review, including those who never submitted. */
export async function loadVerificationReviewQueue(
  admin: SupabaseClient
): Promise<{ entries: VerificationQueueEntry[]; error?: string }> {
  const membersResult = await loadAllRefMembers(admin);
  if (membersResult.error) {
    return { entries: [], error: membersResult.error.message };
  }

  const members = membersResult.data ?? [];
  if (members.length === 0) {
    return { entries: [] };
  }

  const memberIds = members.map((row) => row.id);
  const submissionsResult = await loadSubmissions(admin, memberIds);
  if (submissionsResult.error) {
    return { entries: [], error: submissionsResult.error };
  }

  const [profiles, screenings, authEmails] = await Promise.all([
    loadProfiles(admin, memberIds),
    loadScreenings(admin, memberIds),
    enrichMemberEmails(admin, members),
  ]);

  const submissionByMemberId = new Map(submissionsResult.rows.map((row) => [row.ref_member_id, row]));
  const profileByMemberId = new Map(profiles.map((row) => [row.member_id, row]));
  const screeningByMemberId = new Map(screenings.map((row) => [row.ref_member_id, row]));
  const nowIso = new Date().toISOString();

  const entries: VerificationQueueEntry[] = members.map((member) => {
    const submission = submissionByMemberId.get(member.id);
    const profile = profileByMemberId.get(member.id);
    const screening = screeningByMemberId.get(member.id);
    const createdAt = member.created_at ?? nowIso;

    return {
      ref_member_id: member.id,
      status: submission?.status ?? "not_submitted",
      submitted_at: submission?.submitted_at ?? null,
      reviewed_at: submission?.reviewed_at ?? null,
      resubmitted_at: submission?.resubmitted_at ?? null,
      admin_notes: submission?.admin_notes ?? null,
      fix_required_steps: normalizeFixRequiredSteps(submission?.fix_required_steps),
      created_at: submission?.created_at ?? createdAt,
      updated_at: submission?.updated_at ?? createdAt,
      display_name: member.display_name ?? null,
      email: member.email ?? authEmails.get(member.id) ?? null,
      first_name: member.first_name ?? null,
      last_name: member.last_name ?? null,
      primary_sport: profile?.primary_sport ?? null,
      additional_sports: profile?.additional_sports ?? null,
      certification_level: profile?.certification_level ?? null,
      government_id_path: profile?.government_id_path ?? null,
      government_id_back_path: profile?.verification_doc_path ?? null,
      certification_document_path: profile?.certification_document_path ?? null,
      screening_status: screening?.status ?? null,
      screening_summary: screening?.summary ?? null,
    };
  });

  entries.sort((a, b) => {
    const rank = (status: string) => {
      if (status === "submitted" || status === "under_review") return 0;
      if (status === "draft" || status === "not_submitted") return 1;
      if (status === "rejected") return 2;
      if (status === "approved") return 3;
      return 4;
    };
    const rankDiff = rank(a.status) - rank(b.status);
    if (rankDiff !== 0) return rankDiff;
    const aResubmit = a.resubmitted_at ? new Date(a.resubmitted_at).getTime() : 0;
    const bResubmit = b.resubmitted_at ? new Date(b.resubmitted_at).getTime() : 0;
    if (aResubmit !== bResubmit) return bResubmit - aResubmit;
    const aSubmitted = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
    const bSubmitted = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
    if (aSubmitted !== bSubmitted) return bSubmitted - aSubmitted;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return { entries };
}
