/**
 * Format duration in minutes for display (e.g. "30 min", "1 hr").
 * @param {number | undefined | null} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  const m = minutes ?? 30;
  if (m >= 60) {
    const hrs = m / 60;
    return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`;
  }
  return `${m} min`;
}
