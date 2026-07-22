export type ParsedCsvEvent = {
  title: string;
  sport: string;
  /** ISO datetime for API publish */
  starts_at: string;
  ends_at: string;
  /** datetime-local value for review UI */
  starts_local: string;
  ends_local: string;
  city: string | null;
  state: string | null;
  zip_code: string;
  officials_needed: number;
  pay_offer: number | null;
  /** 1-based CSV data row number for error messages */
  rowNumber: number;
  parseWarning?: string;
};

export type ParseEventsCsvResult = {
  events: ParsedCsvEvent[];
  errors: string[];
  skipped: number;
};

const HEADER_ALIASES: Record<string, string> = {
  title: "title",
  name: "title",
  event: "title",
  event_name: "title",
  eventname: "title",
  game: "title",
  sport: "sport",
  starts_at: "starts_at",
  start: "starts_at",
  start_at: "starts_at",
  start_time: "starts_at",
  starttime: "starts_at",
  begins: "starts_at",
  ends_at: "ends_at",
  end: "ends_at",
  end_at: "ends_at",
  end_time: "ends_at",
  endtime: "ends_at",
  city: "city",
  state: "state",
  zip: "zip_code",
  zip_code: "zip_code",
  zipcode: "zip_code",
  postal: "zip_code",
  postal_code: "zip_code",
  officials_needed: "officials_needed",
  officials: "officials_needed",
  needed: "officials_needed",
  refs_needed: "officials_needed",
  pay_offer: "pay_offer",
  pay: "pay_offer",
  rate: "pay_offer",
  payment: "pay_offer",
};

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Split a CSV line respecting double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cols.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cols.push(current.trim());
  return cols.map((c) => c.replace(/^"|"$/g, "").trim());
}

function toDatetimeLocalValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Parse common schedule formats from spreadsheets / exports.
 * Accepts ISO, US dates, and "YYYY-MM-DD HH:mm".
 */
export function parseFlexibleDate(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  const isoTry = new Date(value);
  if (!Number.isNaN(isoTry.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return isoTry;
  }

  const usMatch = value.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i
  );
  if (usMatch) {
    const month = Number(usMatch[1]);
    const day = Number(usMatch[2]);
    let year = Number(usMatch[3]);
    if (year < 100) year += 2000;
    let hour = usMatch[4] != null ? Number(usMatch[4]) : 12;
    const minute = usMatch[5] != null ? Number(usMatch[5]) : 0;
    const second = usMatch[6] != null ? Number(usMatch[6]) : 0;
    const ampm = (usMatch[7] || "").toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    const d = new Date(year, month - 1, day, hour, minute, second);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function mapHeaderIndexes(headerCols: string[]): Partial<Record<string, number>> {
  const map: Partial<Record<string, number>> = {};
  headerCols.forEach((col, index) => {
    const key = HEADER_ALIASES[normalizeHeader(col)];
    if (key && map[key] == null) map[key] = index;
  });
  return map;
}

function looksLikeHeader(cols: string[]): boolean {
  const joined = cols.map(normalizeHeader).join("|");
  return /title|sport|start|zip|pay|official/.test(joined);
}

/**
 * Parse organizer event CSV.
 * Preferred columns: title, sport, starts_at, ends_at, city, state, zip, officials_needed, pay_offer
 * Also accepts shorter rows without city/state.
 */
export function parseEventsCsv(text: string): ParseEventsCsvResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { events: [], errors: ["CSV is empty."], skipped: 0 };
  }

  const firstCols = splitCsvLine(lines[0]);
  const hasHeader = looksLikeHeader(firstCols);
  const headerMap = hasHeader ? mapHeaderIndexes(firstCols) : {};
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const events: ParsedCsvEvent[] = [];
  const errors: string[] = [];
  let skipped = 0;

  dataLines.forEach((line, index) => {
    const rowNumber = (hasHeader ? index + 2 : index + 1);
    const cols = splitCsvLine(line);
    if (cols.every((c) => !c)) {
      skipped += 1;
      return;
    }

    const get = (key: string, positional: number) => {
      const mapped = headerMap[key];
      if (mapped != null) return cols[mapped] ?? "";
      return cols[positional] ?? "";
    };

    // Positional fallback matches legacy template:
    // title,sport,starts_at,ends_at,city,state,zip,officials_needed,pay_offer
    // or without city/state: title,sport,starts_at,ends_at,zip,officials_needed,pay
    const hasCityState =
      headerMap.city != null ||
      headerMap.state != null ||
      (!hasHeader && cols.length >= 9);

    const title = get("title", 0) || "Event";
    const sport = get("sport", 1) || "Basketball";
    const startRaw = get("starts_at", 2);
    const endRaw = get("ends_at", 3);
    const city = hasCityState ? get("city", 4) || null : null;
    const state = hasCityState ? get("state", 5) || null : null;
    const zip = hasCityState ? get("zip_code", 6) : get("zip_code", 4);
    const neededRaw = hasCityState ? get("officials_needed", 7) : get("officials_needed", 5);
    const payRaw = hasCityState ? get("pay_offer", 8) : get("pay_offer", 6);

    const startDate = parseFlexibleDate(startRaw);
    if (!startDate) {
      errors.push(`Row ${rowNumber}: could not read start date/time (“${startRaw || "blank"}”).`);
      skipped += 1;
      return;
    }

    const endDate = parseFlexibleDate(endRaw) ?? startDate;
    let parseWarning: string | undefined;
    if (endDate.getTime() < startDate.getTime()) {
      parseWarning = "End time was before start — set to match start. Fix before publishing.";
    }

    const zipClean = (zip || "").replace(/\s+/g, "");
    if (zipClean && !/^\d{5}(-\d{4})?$/.test(zipClean)) {
      parseWarning = [parseWarning, `ZIP “${zipClean}” looks invalid — fix before publishing.`]
        .filter(Boolean)
        .join(" ");
    }

    const payNum = payRaw.replace(/[$,]/g, "").trim();
    events.push({
      title,
      sport,
      starts_at: startDate.toISOString(),
      ends_at: (endDate.getTime() < startDate.getTime() ? startDate : endDate).toISOString(),
      starts_local: toDatetimeLocalValue(startDate),
      ends_local: toDatetimeLocalValue(endDate.getTime() < startDate.getTime() ? startDate : endDate),
      city,
      state,
      zip_code: zipClean || "00000",
      officials_needed: Math.max(1, Number(neededRaw) || 1),
      pay_offer: payNum && Number.isFinite(Number(payNum)) ? Number(payNum) : null,
      rowNumber,
      parseWarning,
    });
  });

  if (events.length === 0 && errors.length === 0) {
    errors.push(
      "No event rows found. Use columns: title, sport, starts_at, ends_at, city, state, zip, officials_needed, pay_offer"
    );
  }

  return { events, errors, skipped };
}

export function csvDraftToPublishBody(row: ParsedCsvEvent) {
  const start = new Date(row.starts_local || row.starts_at);
  const end = new Date(row.ends_local || row.ends_at || row.starts_local || row.starts_at);
  return {
    title: row.title.trim() || "Event",
    sport: row.sport.trim() || "Basketball",
    starts_at: Number.isNaN(start.getTime()) ? row.starts_at : start.toISOString(),
    ends_at: Number.isNaN(end.getTime()) ? row.ends_at : end.toISOString(),
    city: row.city?.trim() || null,
    state: row.state?.trim() || null,
    zip_code: row.zip_code.trim() || "00000",
    officials_needed: Math.max(1, Number(row.officials_needed) || 1),
    pay_offer: row.pay_offer,
  };
}
