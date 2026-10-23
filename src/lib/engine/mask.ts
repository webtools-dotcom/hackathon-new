import type { DatasetProfile, Row } from "./schemas";

export const MASK = {
  name: "[name]",
  phone: "[phone]",
  email: "[email]",
} as const;

export function scrubText(value: string): string {
  if (typeof value !== "string") return "";
  let s = value.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]");
  s = s.replace(/(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g, "[phone]");
  return s.slice(0, 64);
}

export function maskRow(row: Row, profile: DatasetProfile): Row {
  const result: Row = {};
  for (const col of profile.columns) {
    const raw = row[col.name] ?? "";
    if (col.kind === "pii") {
      if (raw.trim() === "") {
        result[col.name] = "";
      } else {
        result[col.name] = col.piiType ? MASK[col.piiType] : "[pii]";
      }
    } else if (col.kind === "text") {
      result[col.name] = scrubText(raw);
    } else {
      result[col.name] = raw.slice(0, 64);
    }
  }
  return result;
}

export function buildSamples(
  rows: Row[],
  profile: DatasetProfile,
  n = 5
): Row[] {
  const count = Math.min(n, 5, rows.length);
  if (count <= 0) return [];

  const samples: Row[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor((i * rows.length) / count);
    samples.push(maskRow(rows[index], profile));
  }
  return samples;
}
