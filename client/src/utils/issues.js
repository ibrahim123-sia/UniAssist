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

// Badge colors per issue status, as theme-token var() strings for inline
// styles. Resolved/Closed = success, Pending = warning, In Progress = info,
// Rejected = danger; anything unknown gets a neutral pill.
const STATUS_TOKENS = {
  Pending: "warning",
  "In Progress": "info",
  Resolved: "success",
  Closed: "success",
  Rejected: "danger",
};

export const statusStyle = (status) => {
  const t = STATUS_TOKENS[status];
  if (!t) return { bg: "var(--surface-muted)", text: "var(--text-muted)", border: "var(--border-strong)" };
  return { bg: `var(--${t}-bg)`, text: `var(--${t})`, border: `var(--${t}-border)` };
};
