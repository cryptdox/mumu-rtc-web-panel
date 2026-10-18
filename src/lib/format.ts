export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function span(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** "5m ago", or "in 5m" for future times. */
export function timeAgo(value?: string | null): string {
  if (!value) return "—";
  const s = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (Math.abs(s) < 5) return "just now";
  return s > 0 ? `${span(s)} ago` : `in ${span(-s)}`;
}

export function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatNumber(n: number, digits = 2): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** Turn "VIDEO_MINUTES" into "Video minutes". */
export function humanize(value: string): string {
  const s = value.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Local calendar date as YYYY-MM-DD (for <input type="date">). Never via toISOString, which shifts to UTC. */
export function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfMonth(d = new Date()): string {
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function today(): string {
  return ymd(new Date());
}

/** Local midnight of a YYYY-MM-DD date as an ISO timestamp; `addDays` shifts it (exclusive range ends). */
export function localMidnightIso(date: string, addDays = 0): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d + addDays).toISOString();
}
