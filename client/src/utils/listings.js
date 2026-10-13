import moment from "moment";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

// Uploaded event posters are stored as server-relative paths
// (/uploads/listings/...), like avatars and issue attachments.
export const posterSrc = (url) => {
  if (!url) return null;
  return url.startsWith("/uploads/") ? `${SERVER_URL}${url}` : url;
};

export const isPosterPath = (value) => /^\/uploads\/listings\/[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(value);

// Deadlines are stored as a date (midnight UTC), so read them in UTC to get
// the calendar day the admin picked, then compare it against the local day.
export const deadlineDay = (deadline) =>
  deadline ? moment.utc(deadline).format("YYYY-MM-DD") : "";

export const deadlineInfo = (deadline) => {
  if (!deadline) return null;
  const day = moment(deadlineDay(deadline), "YYYY-MM-DD");
  if (!day.isValid()) return null;
  const days = day.diff(moment().startOf("day"), "days");
  let label;
  let tone;
  if (days < 0) {
    label = "Closed";
    tone = "closed";
  } else if (days === 0) {
    label = "Closes today";
    tone = "urgent";
  } else if (days === 1) {
    label = "Closes tomorrow";
    tone = "urgent";
  } else {
    label = `Closes in ${days} days`;
    tone = days <= 7 ? "soon" : "open";
  }
  return { days, label, tone, date: day.format("MMM D, YYYY") };
};

// Event dates are usually picked as a plain day (stored as midnight UTC, read
// in UTC like deadlines), but a scraped page can give a full date-time — that
// one is read in local time so a late-evening start keeps its own day.
const hasClockTime = (m) =>
  m.hours() !== 0 || m.minutes() !== 0 || m.seconds() !== 0 || m.milliseconds() !== 0;

export const eventDay = (value) => {
  if (!value) return "";
  const utc = moment.utc(value);
  if (!utc.isValid()) return "";
  return hasClockTime(utc) ? moment(value).format("YYYY-MM-DD") : utc.format("YYYY-MM-DD");
};

// Clock time of a scraped date-time ("10:00 AM"), or "" for a plain day.
export const eventClock = (value) => {
  if (!value) return "";
  const utc = moment.utc(value);
  return utc.isValid() && hasClockTime(utc) ? moment(value).format("h:mm A") : "";
};

// Start/end summary for an event: { start, end, days, label, tone, past }.
// `days` counts from today to the start; an event is past once its last day
// (end date, else start date) is before today.
export const eventInfo = (listing) => {
  const startDay = eventDay(listing?.eventDate);
  if (!startDay) return null;
  const start = moment(startDay, "YYYY-MM-DD");
  const endDay = eventDay(listing?.eventEndDate);
  const end = endDay ? moment(endDay, "YYYY-MM-DD") : null;
  const today = moment().startOf("day");
  const days = start.diff(today, "days");
  const lastDay = end && end.isAfter(start) ? end : start;
  const past = lastDay.isBefore(today);
  let label;
  let tone;
  if (past) {
    label = "Ended";
    tone = "closed";
  } else if (days < 0) {
    label = "Happening now";
    tone = "urgent";
  } else if (days === 0) {
    label = "Today";
    tone = "urgent";
  } else if (days === 1) {
    label = "Tomorrow";
    tone = "urgent";
  } else {
    label = `In ${days} days`;
    tone = days <= 7 ? "soon" : "open";
  }
  const sameYear = start.year() === today.year();
  const fmt = sameYear ? "ddd, MMM D" : "ddd, MMM D, YYYY";
  let range = start.format(fmt);
  if (end && end.isAfter(start)) range += ` – ${end.format(fmt)}`;
  return { start, end, days, label, tone, past, range };
};

export const KIND_LABELS = {
  job: { one: "Job", many: "Jobs" },
  scholarship: { one: "Scholarship", many: "Scholarships" },
  event: { one: "Event", many: "Events" },
};

// Editable listing fields per kind, in form order. `long` → textarea.
const COMMON_TOP = [
  { key: "title", label: "Title", required: true, max: 200 },
  { key: "organization", label: "Organization", max: 200 },
  { key: "location", label: "Location" },
  { key: "deadline", label: "Deadline", type: "date" },
];

const COMMON_BOTTOM = [
  { key: "description", label: "Description", long: true, rows: 8, max: 5000 },
  { key: "requirements", label: "Requirements", long: true, rows: 4, max: 3000 },
  { key: "applyUrl", label: "Apply link", type: "url" },
];

export const LISTING_FIELDS = {
  job: [
    ...COMMON_TOP,
    { key: "employmentType", label: "Employment type", placeholder: "e.g. Full-time, Internship" },
    { key: "salary", label: "Salary" },
    ...COMMON_BOTTOM,
  ],
  scholarship: [
    ...COMMON_TOP,
    { key: "fundingType", label: "Funding type", placeholder: "e.g. Fully funded" },
    { key: "amount", label: "Amount" },
    { key: "degreeLevel", label: "Degree level", placeholder: "e.g. Masters, PhD" },
    ...COMMON_BOTTOM.slice(0, 2),
    { key: "eligibility", label: "Eligibility", long: true, rows: 4, max: 3000 },
    COMMON_BOTTOM[2],
  ],
  // Events reuse organization/location/deadline/applyUrl under event names.
  event: [
    { key: "title", label: "Title", required: true, max: 200 },
    { key: "organization", label: "Organizer", max: 200 },
    { key: "location", label: "Venue", placeholder: "e.g. Main Auditorium, or Online" },
    { key: "eventDate", label: "Event date", type: "date", publishRequired: true },
    { key: "eventEndDate", label: "End date", type: "date" },
    { key: "eventTime", label: "Time", placeholder: "e.g. 10:00 AM – 1:00 PM", max: 100 },
    { key: "deadline", label: "Registration deadline", type: "date" },
    { key: "description", label: "Description", long: true, rows: 8, max: 5000 },
    { key: "applyUrl", label: "Registration link", type: "url" },
    { key: "posterUrl", label: "Poster", type: "poster", max: 2000 },
  ],
};

export const isHttpUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

// href for a stored link, or null when it isn't a plain http(s) URL (defence
// in depth: the server validates too, but a bad value must never become a
// javascript:/data: link).
export const safeHref = (value) => (typeof value === "string" && isHttpUrl(value.trim()) ? value.trim() : null);

// Same page, ignoring a trailing slash and the #fragment.
export const sameUrl = (a, b) => {
  const norm = (v) => {
    try {
      const u = new URL(v);
      u.hash = "";
      return u.toString().replace(/\/+$/, "");
    } catch {
      return String(v || "").trim();
    }
  };
  return !!a && !!b && norm(a) === norm(b);
};
