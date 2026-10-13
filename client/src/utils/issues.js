// An escalated issue (no staff response within its department's SLA) stays
// "overdue" while it is still open; once handled, the flag is only history.
export const OPEN_STATUSES = ["Pending", "In Progress"];

export const isOverdue = (issue) => !!issue?.escalated && OPEN_STATUSES.includes(issue?.status);

// "5.2 h", "45 min", "3.1 d" — for average first-response times.
export const formatHours = (hours) => {
  if (hours === null || hours === undefined || Number.isNaN(Number(hours))) return "—";
  const h = Number(hours);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h >= 48) return `${(h / 24).toFixed(1)} d`;
  return `${h.toFixed(1)} h`;
};
