const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format availability array for display on event type cards.
 * @param {Array<{ day: number, start: string, end: string }>} availability
 * @returns {string} e.g. "Wed, 19:00 - 21:00" or "Mon, Wed, Fri, 09:00 - 17:00" or "hours vary"
 */
export function formatAvailability(availability) {
  if (!Array.isArray(availability) || availability.length === 0) {
    return 'No availability set';
  }

  const byTimeRange = new Map();
  for (const w of availability) {
    const key = `${w.start}-${w.end}`;
    if (!byTimeRange.has(key)) {
      byTimeRange.set(key, []);
    }
    byTimeRange.get(key).push(w.day);
  }

  if (byTimeRange.size === 1) {
    const [[range, days]] = Array.from(byTimeRange.entries());
    const [start, end] = range.split('-');
    const dayStr = [...days].sort((a, b) => a - b).map((d) => DAY_NAMES[d]).join(', ');
    return `${dayStr}, ${start} - ${end}`;
  }

  const allSameDays = (() => {
    const values = Array.from(byTimeRange.values());
    const firstDays = [...values[0]].sort((a, b) => a - b).join(',');
    return values.every(
      (days) => [...days].sort((a, b) => a - b).join(',') === firstDays
    );
  })();

  if (!allSameDays) {
    return 'Hours vary';
  }

  const ranges = Array.from(byTimeRange.entries())
    .map(([range]) => {
      const [start, end] = range.split('-');
      return `${start} - ${end}`;
    })
    .join('; ');
  const days = [...Array.from(byTimeRange.values())[0]]
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d])
    .join(', ');
  return `${days}, ${ranges}`;
}
