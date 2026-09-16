/**
 * Locale-aware single-letter weekday labels (via Intl), so day-of-week chips
 * read correctly in any language without a translation entry per letter.
 */
const FALLBACK_SUNDAY_FIRST = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A known Sunday to walk forward from when formatting each weekday name.
const REFERENCE_SUNDAY = new Date(2023, 0, 1);

/**
 * Returns 7 narrow weekday labels, starting at `startDay`
 * (0 = Sunday … 6 = Saturday). Falls back to English abbreviations if
 * Intl.DateTimeFormat can't format the given locale.
 */
export function getNarrowWeekdays(locale: string, startDay: 0 | 1 = 0): string[] {
  let sundayFirst: string[];
  try {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    sundayFirst = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(REFERENCE_SUNDAY);
      d.setDate(d.getDate() + i);
      return fmt.format(d);
    });
  } catch {
    sundayFirst = FALLBACK_SUNDAY_FIRST;
  }
  return [...sundayFirst.slice(startDay), ...sundayFirst.slice(0, startDay)];
}
