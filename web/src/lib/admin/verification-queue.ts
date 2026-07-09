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
};

function missingColumn(error: { message?: string } | null, column: string) {
  return Boolean(error?.message?.includes(column));
}

async function loadMembers(admin: SupabaseClient, memberIds: string[]) {
  const full = await admin
    .from("members")
    .select("id, role, display_name, email, first_name, last_name")
    .in("id", memberIds);

  if (
    !full.error ||
    (!missingColumn(full.error, "email") &&
      !missingColumn(full.error, "first_name") &&
      !missingColumn(full.error, "last_name"))
  ) {
    return full.data as MemberRow[] | null;
  }

  const basic = await admin.from("members").select("id, role, display_name").in("id", memberIds);
  return (basic.data as MemberRow[] | null) ?? null;
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

/** Load admin verification queue from base tables (no DB view required). */
export async function loadVerificationReviewQueue(
  admin: SupabaseClient
): Promise<{ entries: VerificationQueueEntry[]; error?: string }> {
  const { data: submissions, error: submissionsError } = await admin
    .from("ref_verification_submissions")
    .select(
      "ref_member_id, status, submitted_at, reviewed_at, resubmitted_at, admin_notes, fix_required_steps, created_at, updated_at"
    )
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (submissionsError) {
    if (submissionsError.message.includes("ref_verification_submissions")) {
      return {
        entries: [],
        error:
          "The ref_verification_submissions table is missing. In Supabase → SQL Editor, run the full script in supabase/RUN_ADMIN_VERIFICATION_SETUP.sql (it creates the table and backfills existing refs).",
      };
    }
    return { entries: [], error: submissionsError.message };
  }

  if (!submissions?.length) {
    return { entries: [] };
  }

  const memberIds = submissions.map((row) => row.ref_member_id);

  const [members, profilesResult, screeningsResult] = await Promise.all([
    loadMembers(admin, memberIds),
    admin
      .from("ref_profiles")
      .select(
        "member_id, primary_sport, additional_sports, certification_level, government_id_path, verification_doc_path, certification_document_path"
      )
      .in("member_id", memberIds),
    admin.from("screening_checks").select("ref_member_id, status, summary").in("ref_member_id", memberIds),
  ]);

  const authEmails = await enrichMemberEmails(admin, members ?? []);

  const memberById = new Map((members ?? []).map((row) => [row.id, row]));
  const profileByMemberId = new Map((profilesResult.data ?? []).map((row) => [row.member_id, row]));
  const screeningByMemberId = new Map((screeningsResult.data ?? []).map((row) => [row.ref_member_id, row]));

  const entries: VerificationQueueEntry[] = [];

  for (const submission of submissions) {
    const member = memberById.get(submission.ref_member_id);
    if (member?.role !== "ref") continue;
    const profile = profileByMemberId.get(submission.ref_member_id);
    const screening = screeningByMemberId.get(submission.ref_member_id);

    entries.push({
      ref_member_id: submission.ref_member_id,
      status: submission.status,
      submitted_at: submission.submitted_at,
      reviewed_at: submission.reviewed_at,
      resubmitted_at: (submission as { resubmitted_at?: string | null }).resubmitted_at ?? null,
      admin_notes: submission.admin_notes,
      fix_required_steps: normalizeFixRequiredSteps(
        (submission as { fix_required_steps?: unknown }).fix_required_steps
      ),
      created_at: submission.created_at,
      updated_at: submission.updated_at,
      display_name: member?.display_name ?? null,
      email: member?.email ?? authEmails.get(submission.ref_member_id) ?? null,
      first_name: member?.first_name ?? null,
      last_name: member?.last_name ?? null,
      primary_sport: profile?.primary_sport ?? null,
      additional_sports: profile?.additional_sports ?? null,
      certification_level: profile?.certification_level ?? null,
      government_id_path: profile?.government_id_path ?? null,
      government_id_back_path: profile?.verification_doc_path ?? null,
      certification_document_path: profile?.certification_document_path ?? null,
      screening_status: screening?.status ?? null,
      screening_summary: screening?.summary ?? null,
    });
  }

  entries.sort((a, b) => {
    const aResubmit = a.resubmitted_at ? new Date(a.resubmitted_at).getTime() : 0;
    const bResubmit = b.resubmitted_at ? new Date(b.resubmitted_at).getTime() : 0;
    if (aResubmit !== bResubmit) return bResubmit - aResubmit;
    const aSubmitted = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
    const bSubmitted = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
    return bSubmitted - aSubmitted;
  });

  return { entries };
}
