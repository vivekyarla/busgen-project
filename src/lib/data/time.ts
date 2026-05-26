/** Month arithmetic for the time slider. Index = year*12 + (month-1). */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Parse "YYYY-MM" (or "YYYY") into a month index, or null if unparseable. */
export function monthIndex(date?: string | null): number | null {
  if (!date) return null;
  const ym = /^(\d{4})-(\d{1,2})/.exec(date);
  if (ym) return Number(ym[1]) * 12 + (Number(ym[2]) - 1);
  const y = /^(\d{4})/.exec(date);
  if (y) return Number(y[1]) * 12; // year-only → January
  return null;
}

/** "Apr 2024" for a month index. */
export function monthLabel(idx: number): string {
  const year = Math.floor(idx / 12);
  const mo = ((idx % 12) + 12) % 12;
  return `${MONTHS[mo]} ${year}`;
}
