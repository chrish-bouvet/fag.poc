import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const STATUS_LABELS = [
  "status:invalid",
  "status:needs-review",
  "status:approved",
  "status:historical",
  "status:cancelled"
];

const FIELD_ALIASES = new Map([
  ["Tittel", "title"],
  ["Ansvarlig", "owner"],
  ["Fagmiljo", "community"],
  ["Fagmiljø", "community"],
  ["Kort beskrivelse for infoskjermer", "short_description"],
  ["Tags", "tags"],
  ["Dato og klokkeslett", "datetime"],
  ["Link til pamelding", "signup_url"],
  ["Link til påmelding", "signup_url"],
  ["Beskrivelse", "description"]
]);

const REQUIRED_FIELDS = [
  "title",
  "owner",
  "community",
  "short_description",
  "tags",
  "datetime",
  "signup_url",
  "description"
];

export function parseIssueBody(body = "") {
  const result = {};
  let currentField = null;
  let buffer = [];

  const flush = () => {
    if (!currentField) {
      return;
    }

    result[currentField] = buffer.join("\n").trim();
    buffer = [];
  };

  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+)$/);
    if (heading) {
      flush();
      currentField = FIELD_ALIASES.get(heading[1].trim()) ?? null;
      continue;
    }

    if (currentField) {
      buffer.push(line);
      continue;
    }

    const legacy = line.match(/^([^:]+):\s*(.*)$/);
    if (legacy) {
      const legacyField = FIELD_ALIASES.get(legacy[1].trim()) ?? null;
      if (legacyField) {
        flush();
        currentField = legacyField;
        buffer = [legacy[2]];
      }
    }
  }

  flush();
  return result;
}

function normalizeSingleLine(value = "") {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTags(value = "") {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function normalizeEvent(rawEvent = {}, issue = {}) {
  const normalized = {
    issue_number: issue.number ?? null,
    issue_title: issue.title ?? null,
    title: normalizeSingleLine(rawEvent.title),
    owner: normalizeSingleLine(rawEvent.owner),
    community: normalizeSingleLine(rawEvent.community),
    short_description: normalizeSingleLine(rawEvent.short_description),
    tags: parseTags(rawEvent.tags),
    datetime: normalizeSingleLine(rawEvent.datetime),
    signup_url: normalizeSingleLine(rawEvent.signup_url),
    description: (rawEvent.description ?? "").trim(),
    labels: extractLabelNames(issue.labels ?? []),
    state: issue.state ?? "open"
  };

  normalized.slug = buildSlug(normalized.title, normalized.issue_number);
  normalized.date = normalized.datetime.slice(0, 10);
  normalized.status = extractStatus(normalized.labels);

  return normalized;
}

export function validateEvent(event) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (Array.isArray(event[field])) {
      if (event[field].length === 0) {
        errors.push(`Field ${field} must not be empty.`);
      }
      continue;
    }

    if (!event[field]) {
      errors.push(`Field ${field} must not be empty.`);
    }
  }

  if (event.datetime && !isValidDateTime(event.datetime)) {
    errors.push("Field datetime must match YYYY-MM-DD HH:mm and be a valid Europe/Oslo date.");
  }

  if (event.signup_url && !isValidUrl(event.signup_url)) {
    errors.push("Field signup_url must be a valid URL.");
  }

  if (event.short_description && event.short_description.length > 160) {
    errors.push("Field short_description should be 160 characters or less.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function isValidDateTime(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!match) {
    return false;
  }

  const [, year, month, day, hour, minute] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day &&
    candidate.getUTCHours() === hour &&
    candidate.getUTCMinutes() === minute
  );
}

export function isValidUrl(value) {
  try {
    const url = new URL(value);
    return Boolean(url.protocol && url.host);
  } catch {
    return false;
  }
}

export function extractLabelNames(labels = []) {
  return labels.map((label) => (typeof label === "string" ? label : label.name)).filter(Boolean);
}

export function extractStatus(labels = []) {
  const names = extractLabelNames(labels);
  return STATUS_LABELS.find((label) => names.includes(label)) ?? null;
}

export function replaceStatusLabels(labels = [], nextStatus) {
  const names = extractLabelNames(labels).filter((label) => !STATUS_LABELS.includes(label));

  if (nextStatus) {
    names.push(nextStatus);
  }

  return Array.from(new Set(names));
}

export function shouldBeHistorical(datetimeValue, now = new Date()) {
  const eventDate = datetimeValue.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return false;
  }

  const todayOslo = formatDateInTimeZone(now, "Europe/Oslo");
  const yesterdayOslo = shiftIsoDate(todayOslo, -1);
  return eventDate <= yesterdayOslo;
}

export function formatDateInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function shiftIsoDate(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function buildSlug(title, issueNumber) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return issueNumber ? `${base}-${issueNumber}` : base || "event";
}

export function toCanonicalEvent(issue) {
  const parsed = parseIssueBody(issue.body ?? "");
  const normalized = normalizeEvent(parsed, issue);
  const validation = validateEvent(normalized);

  return {
    ...normalized,
    valid: validation.valid,
    errors: validation.errors,
    url: issue.html_url ?? null,
    status: normalized.status ?? (validation.valid ? "status:needs-review" : "status:invalid")
  };
}

export async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}