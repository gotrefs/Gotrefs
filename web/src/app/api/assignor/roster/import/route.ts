import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ParsedRef = {
  display_name: string;
  contact_email: string | null;
  primary_sport: string;
  certification_level: string | null;
  rate_per_game: number | null;
  notes: string | null;
};

async function requireAssignor(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("ref_profiles")
    .select("is_assignor")
    .eq("member_id", userId)
    .maybeSingle();
  return Boolean(data?.is_assignor);
}

function splitRow(line: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && (char === "," || char === "\t" || char === ";")) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current.trim());
  return out.map((value) => value.replace(/^"|"$/g, "").trim());
}

function parseMoney(value: string | undefined) {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function pick(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[name];
    if (value?.trim()) return value.trim();
  }
  return "";
}

function parseRosterText(text: string): ParsedRef[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const first = splitRow(lines[0]).map(normalizeHeader);
  const hasHeader = first.some((header) =>
    ["name", "full_name", "ref_name", "display_name", "email", "contact_email", "sport", "primary_sport"].includes(header)
  );
  const headers = hasHeader ? first : ["display_name", "contact_email", "primary_sport", "certification_level", "rate_per_game", "notes"];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const values = splitRow(line);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
      const firstName = pick(row, ["first_name", "firstname"]);
      const lastName = pick(row, ["last_name", "lastname"]);
      const displayName =
        pick(row, ["display_name", "full_name", "ref_name", "name"]) || [firstName, lastName].filter(Boolean).join(" ");
      const email = pick(row, ["contact_email", "email", "email_address"]);
      const primarySport = pick(row, ["primary_sport", "sport", "sports"]) || "Basketball";
      const certification = pick(row, ["certification_level", "certification", "level", "cert"]);
      const rate = pick(row, ["rate_per_game", "rate", "pay", "fee"]);
      const notes = pick(row, ["notes", "note", "details"]);

      return {
        display_name: displayName.trim(),
        contact_email: email.includes("@") ? email.toLowerCase() : null,
        primary_sport: primarySport.trim() || "Basketball",
        certification_level: certification.trim() || null,
        rate_per_game: parseMoney(rate),
        notes: notes.trim() || null,
      };
    })
    .filter((row) => row.display_name);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const isAssignor = await requireAssignor(user.id, supabase);
  if (!isAssignor) {
    return NextResponse.json({ error: "Enable assignor mode before importing refs." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a CSV or text file." }, { status: 400 });
  }

  const text = await file.text();
  const parsed = parseRosterText(text).slice(0, 500);
  if (parsed.length === 0) {
    return NextResponse.json({ error: "No refs were found in that file." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const rows = parsed.map((ref) => ({
    assignor_member_id: user.id,
    display_name: ref.display_name,
    contact_email: ref.contact_email,
    primary_sport: ref.primary_sport,
    additional_sports: [],
    certification_level: ref.certification_level,
    rate_per_game: ref.rate_per_game,
    availability: [],
    notes: ref.notes,
    updated_at: now,
  }));

  const { data, error } = await supabase
    .from("assignor_roster_entries")
    .insert(rows)
    .select(
      "id, display_name, contact_email, primary_sport, additional_sports, certification_level, rate_per_game, availability, notes, created_at"
    );

  if (error) {
    console.error("[api/assignor/roster/import]", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    imported: data?.length ?? 0,
    entries: data ?? [],
  });
}
