/**
 * Format duration in minutes for display (e.g. "30 min", "1 hr").
 * @param {number | undefined | null} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  const m = minutes ?? 30;
  if (m >= 60) return `${m / 60} hr`;
  return `${m} min`;
}
