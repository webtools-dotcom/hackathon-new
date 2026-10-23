/** Column profiler: infers each column's kind (number, date, category, text, pii) from raw CSV strings. */
import type {
  ColumnProfile,
  DatasetProfile,
  PiiType,
  Row,
} from "./schemas";

export function parseNumber(raw: string): number | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;

  // Remove currency signs and codes (Rs. before Rs), commas, whitespace
  s = s.replace(/₹|Rs\.|Rs|INR/gi, "");
  s = s.replace(/[\s,]/g, "");

  if (!s || s === "-" || s === "+") return null;

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseDate(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Optionally followed by a space and a time, which is ignored
  const datePart = trimmed.split(/\s+/)[0];

  let y: number;
  let m: number;
  let d: number;

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(datePart);
  const dashMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(datePart);
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(datePart);

  if (isoMatch) {
    y = parseInt(isoMatch[1], 10);
    m = parseInt(isoMatch[2], 10);
    d = parseInt(isoMatch[3], 10);
  } else if (dashMatch) {
    d = parseInt(dashMatch[1], 10);
    m = parseInt(dashMatch[2], 10);
    y = parseInt(dashMatch[3], 10);
  } else if (slashMatch) {
    d = parseInt(slashMatch[1], 10);
    m = parseInt(slashMatch[2], 10);
    y = parseInt(slashMatch[3], 10);
  } else {
    return null;
  }

  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const utc = new Date(Date.UTC(y, m - 1, d));
  if (
    utc.getUTCFullYear() !== y ||
    utc.getUTCMonth() !== m - 1 ||
    utc.getUTCDate() !== d
  ) {
    return null;
  }

  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return iso;
}

export function detectPii(name: string, values: string[]): PiiType | null {
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "_");

  // Name rules first (item_name must NOT be PII)
  if (norm !== "item_name" && !norm.includes("item_name")) {
    if (norm.includes("email") || norm.includes("e_mail")) {
      return "email";
    }
    if (norm.includes("phone") || norm.includes("mobile") || norm.includes("contact")) {
      return "phone";
    }
    if (
      norm === "name" ||
      norm.includes("customer") ||
      norm.includes("guest") ||
      norm.includes("patient") ||
      norm.includes("client") ||
      norm.includes("buyer")
    ) {
      return "name";
    }
  }

  // Value rules (non-empty values only, need >= 50%)
  const nonEmpty = values
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v !== "");

  if (nonEmpty.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(\+?91)?[6-9]\d{9}$/;

    let emailCount = 0;
    let phoneCount = 0;

    for (const val of nonEmpty) {
      if (emailRegex.test(val)) {
        emailCount++;
      }
      const strippedPhone = val.replace(/[\s-]/g, "");
      if (phoneRegex.test(strippedPhone)) {
        phoneCount++;
      }
    }

    if (emailCount / nonEmpty.length >= 0.5) {
      return "email";
    }
    if (phoneCount / nonEmpty.length >= 0.5) {
      return "phone";
    }
  }

  return null;
}

export function profileRows(rows: Row[], columns: string[]): DatasetProfile {
  if (columns.length > 40) {
    throw new Error("too_many_columns");
  }

  const columnProfiles: ColumnProfile[] = [];

  for (const colName of columns) {
    const values: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      values.push(rows[i][colName] ?? "");
    }

    const trimmedNonEmpty: string[] = [];
    for (const val of values) {
      const t = val.trim();
      if (t !== "") {
        trimmedNonEmpty.push(t);
      }
    }

    const nonEmptyCount = trimmedNonEmpty.length;
    const missing = rows.length - nonEmptyCount;

    // Distinct trimmed non-empty values
    const distinctSet = new Set(trimmedNonEmpty);
    const distinct = distinctSet.size;

    const piiType = detectPii(colName, values);

    if (piiType !== null) {
      columnProfiles.push({
        name: colName,
        kind: "pii",
        piiType,
        distinct,
        missing,
        min: null,
        max: null,
        topValues: [],
      });
      continue;
    }

    if (nonEmptyCount === 0) {
      columnProfiles.push({
        name: colName,
        kind: "text",
        piiType: null,
        distinct: 0,
        missing: rows.length,
        min: null,
        max: null,
        topValues: [],
      });
      continue;
    }

    // Number check: >= 90%
    const parsedNumbers: number[] = [];
    for (const v of trimmedNonEmpty) {
      const num = parseNumber(v);
      if (num !== null) {
        parsedNumbers.push(num);
      }
    }

    if (parsedNumbers.length / nonEmptyCount >= 0.9) {
      let minVal = parsedNumbers[0];
      let maxVal = parsedNumbers[0];
      for (let i = 1; i < parsedNumbers.length; i++) {
        const val = parsedNumbers[i];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }

      columnProfiles.push({
        name: colName,
        kind: "number",
        piiType: null,
        distinct,
        missing,
        min: minVal,
        max: maxVal,
        topValues: [],
      });
      continue;
    }

    // Date check: >= 90%
    const parsedDates: string[] = [];
    for (const v of trimmedNonEmpty) {
      const dt = parseDate(v);
      if (dt !== null) {
        parsedDates.push(dt);
      }
    }

    if (parsedDates.length / nonEmptyCount >= 0.9) {
      let minDate = parsedDates[0];
      let maxDate = parsedDates[0];
      for (let i = 1; i < parsedDates.length; i++) {
        const dt = parsedDates[i];
        if (dt < minDate) minDate = dt;
        if (dt > maxDate) maxDate = dt;
      }

      columnProfiles.push({
        name: colName,
        kind: "date",
        piiType: null,
        distinct,
        missing,
        min: minDate,
        max: maxDate,
        topValues: [],
      });
      continue;
    }

    // Category check: distinct <= 50 or distinct / nonEmpty <= 0.5
    if (distinct <= 50 || distinct / nonEmptyCount <= 0.5) {
      const freqMap = new Map<string, number>();
      for (const v of trimmedNonEmpty) {
        freqMap.set(v, (freqMap.get(v) ?? 0) + 1);
      }

      const entries = Array.from(freqMap.entries()).sort((a, b) => {
        if (b[1] !== a[1]) {
          return b[1] - a[1]; // Most frequent first
        }
        return a[0].localeCompare(b[0]); // Ties: alphabetical
      });

      const topValues = entries
        .slice(0, 8)
        .map(([val]) => val.slice(0, 64));

      columnProfiles.push({
        name: colName,
        kind: "category",
        piiType: null,
        distinct,
        missing,
        min: null,
        max: null,
        topValues,
      });
      continue;
    }

    // Else text
    columnProfiles.push({
      name: colName,
      kind: "text",
      piiType: null,
      distinct,
      missing,
      min: null,
      max: null,
      topValues: [],
    });
  }

  return {
    rowCount: rows.length,
    columns: columnProfiles,
  };
}
