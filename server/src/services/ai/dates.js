// Deterministic due-date resolution. The model is never trusted to do calendar
// math, and the server's *current* date is never used: everything is relative
// to the meeting's own date in the meeting's timezone.

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

const validYmd = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

// Meeting dates are stored as calendar dates (noon UTC of the chosen day), so the
// calendar day is the UTC date regardless of the meeting's timezone.
export const localDateParts = (date) => {
  const d = new Date(date);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};

const addDays = ({ y, m, d }, n) => {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
};

const cmp = (a, b) => (a.y - b.y) || (a.m - b.m) || (a.d - b.d);

/** @returns {string|null} YYYY-MM-DD, or null when the text is missing or ambiguous */
export const resolveDueDate = (rawText, meetingDate) => {
  if (!rawText) return null;
  const t = rawText.toLowerCase();
  const base = localDateParts(meetingDate);
  const found = new Set();

  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    if (validYmd(+m[1], +m[2], +m[3])) found.add(iso(+m[1], +m[2], +m[3]));
  }

  const monthRe = MONTHS.join('|');
  const resolveMD = (month, day, year) => {
    if (year) return validYmd(year, month, day) ? iso(year, month, day) : null;
    let cand = { y: base.y, m: month, d: day };
    if (!validYmd(cand.y, cand.m, cand.d)) return null;
    if (cmp(cand, base) < 0) cand = { ...cand, y: cand.y + 1 };
    return validYmd(cand.y, cand.m, cand.d) ? iso(cand.y, cand.m, cand.d) : null;
  };
  const mdRe = new RegExp(`\\b(${monthRe})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'g');
  const dmRe = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthRe})[a-z]*\\.?(?:,?\\s+(\\d{4}))?\\b`, 'g');
  for (const m of t.matchAll(mdRe)) {
    const r = resolveMD(MONTHS.indexOf(m[1]) + 1, +m[2], m[3] ? +m[3] : null);
    if (r) found.add(r);
  }
  for (const m of t.matchAll(dmRe)) {
    const r = resolveMD(MONTHS.indexOf(m[2]) + 1, +m[1], m[3] ? +m[3] : null);
    if (r) found.add(r);
  }

  if (/\btomorrow\b/.test(t)) {
    const n = addDays(base, 1);
    found.add(iso(n.y, n.m, n.d));
  }
  // "Friday" -> first Friday strictly after the meeting date.
  // "next Friday" is genuinely ambiguous, so it stays unresolved.
  const baseDow = new Date(Date.UTC(base.y, base.m - 1, base.d)).getUTCDay();
  for (const m of t.matchAll(/\b(next\s+|last\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)) {
    if (m[1]) return null;
    const diff = ((WEEKDAYS.indexOf(m[2]) - baseDow + 6) % 7) + 1;
    const n = addDays(base, diff);
    found.add(iso(n.y, n.m, n.d));
  }

  // "today" / "EOD" only stands alone; with a weekday or date it is just a time-of-day qualifier.
  if (found.size === 0 && /\b(today|end of day|eod)\b/.test(t)) {
    found.add(iso(base.y, base.m, base.d));
  }

  return found.size === 1 ? [...found][0] : null;
};
