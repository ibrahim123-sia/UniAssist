import React from "react";
import { View, Text, Pressable, Linking, Alert } from "react-native";
import { ExternalLink } from "lucide-react-native";
import moment from "moment";
import { useTheme } from "../hooks/useTheme";
import { fileUrl } from "../api/client";
import type { Listing } from "../api/listings";

// The server stores a "YYYY-MM-DD" deadline as UTC midnight; read the calendar
// date in UTC so it doesn't shift a day in timezones west of UTC.
const deadlineDay = (deadline?: string | null) => {
  if (!deadline) return null;
  const utc = moment.utc(deadline);
  return utc.isValid() ? moment(utc.format("YYYY-MM-DD"), "YYYY-MM-DD") : null;
};

export const deadlineInfo = (deadline?: string | null) => {
  const day = deadlineDay(deadline);
  if (!day) return null;
  const days = day.diff(moment().startOf("day"), "days");
  const label =
    days < 0 ? "Closed"
      : days === 0 ? "Closes today"
      : `Closes in ${days} day${days === 1 ? "" : "s"}`;
  return { days, label, closed: days < 0, date: day.format("DD MMM YYYY") };
};

export const DeadlineBadge: React.FC<{ deadline?: string | null }> = ({ deadline }) => {
  const { C } = useTheme();
  const info = deadlineInfo(deadline);
  if (!info) return null;
  const color = info.closed ? C.red : info.days <= 7 ? C.amber : C.green;
  return (
    <View style={{
      alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
      backgroundColor: `${color}22`,
    }}>
      <Text style={{ color, fontSize: 10, fontWeight: "700" }}>{info.label}</Text>
    </View>
  );
};

// Job: employment type + salary. Scholarship: funding type/amount + level.
// Events have their own card layout.
export const listingTypeLine = (l: Listing): string =>
  (l.kind === "job"
    ? [l.employmentType, l.salary]
    : l.kind === "scholarship"
      ? [l.fundingType, l.amount, l.degreeLevel]
      : []
  ).filter((v) => !!v && String(v).trim()).join(" · ");

export const isHttpUrl = (u?: string | null): u is string => !!u && /^https?:\/\//i.test(u);

// Posters are an external http(s) image or an admin upload served by the
// Node server (/uploads/listings/...), resolved like avatars/attachments.
export const posterUri = (l: Pick<Listing, "posterUrl">): string | null => {
  const p = l.posterUrl?.trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  return p.startsWith("/uploads/") ? fileUrl(p) : null;
};

// A date-only event date is stored as UTC midnight (like deadlines): read its
// calendar day in UTC. Anything else is a real start time shown in local time.
const eventMoment = (value?: string | null) => {
  if (!value) return null;
  const utc = moment.utc(value);
  if (!utc.isValid()) return null;
  if (utc.format("HH:mm:ss.SSS") === "00:00:00.000") {
    return { m: moment(utc.format("YYYY-MM-DD"), "YYYY-MM-DD"), dateOnly: true };
  }
  return { m: moment(value), dateOnly: false };
};

export type EventStatus = "upcoming" | "today" | "ongoing" | "past";

// Same rule as the server's Upcoming filter: an event is past once its last
// day (end date, else start date) is before today.
export const eventInfo = (l: Pick<Listing, "eventDate" | "eventEndDate" | "eventTime">) => {
  const start = eventMoment(l.eventDate);
  if (!start) return null;
  const rawEnd = eventMoment(l.eventEndDate);
  const end = rawEnd && !rawEnd.m.isBefore(start.m) ? rawEnd : null;
  const today = moment().startOf("day");
  const firstDay = start.m.clone().startOf("day");
  const lastDay = (end || start).m.clone().startOf("day");
  const multiDay = !lastDay.isSame(firstDay, "day");

  const days = firstDay.diff(today, "days");
  let status: EventStatus;
  let label: string;
  if (lastDay.isBefore(today)) { status = "past"; label = "Past"; }
  else if (days > 0) { status = "upcoming"; label = days === 1 ? "Tomorrow" : `In ${days} days`; }
  else if (days === 0 && !multiDay) { status = "today"; label = "Today"; }
  else { status = "ongoing"; label = days === 0 ? "Starts today" : "Ongoing"; }

  const dateLabel = !multiDay
    ? start.m.format("ddd, DD MMM YYYY")
    : firstDay.isSame(lastDay, "year")
      ? `${start.m.format("DD MMM")} – ${end!.m.format("DD MMM YYYY")}`
      : `${start.m.format("DD MMM YYYY")} – ${end!.m.format("DD MMM YYYY")}`;

  // The admin's free-text time wins; otherwise a real start time if we have one.
  let timeLabel: string | null = l.eventTime?.trim() || null;
  if (!timeLabel && !start.dateOnly) {
    timeLabel = start.m.format("h:mm A");
    if (end && !end.dateOnly && !multiDay) timeLabel += ` – ${end.m.format("h:mm A")}`;
  }

  return {
    status, label, past: status === "past", dateLabel, timeLabel,
    month: start.m.format("MMM").toUpperCase(), day: start.m.format("D"),
  };
};

export const isPastEvent = (l: Listing) => !!eventInfo(l)?.past;

export const EventStatusBadge: React.FC<{ listing: Listing }> = ({ listing }) => {
  const { C } = useTheme();
  const info = eventInfo(listing);
  if (!info) return null;
  const color = info.past ? C.muted : info.status === "upcoming" ? C.green : C.amber;
  return (
    <View style={{
      alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
      backgroundColor: `${color}22`,
    }}>
      <Text style={{ color, fontSize: 10, fontWeight: "700" }}>{info.label}</Text>
    </View>
  );
};

// Calendar-leaf date block (month over day) for event cards.
export const EventDateBadge: React.FC<{ listing: Listing }> = ({ listing }) => {
  const { C } = useTheme();
  const info = eventInfo(listing);
  if (!info) return null;
  const color = info.past ? C.muted : C.navy;
  return (
    <View style={{
      width: 48, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: color,
      alignItems: "center", backgroundColor: C.surface,
    }}>
      <Text style={{
        color: info.past ? C.surface : C.onNavy, backgroundColor: color, fontSize: 10, fontWeight: "800",
        width: "100%", textAlign: "center", paddingVertical: 2,
      }}>
        {info.month}
      </Text>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", paddingVertical: 3 }}>{info.day}</Text>
    </View>
  );
};

// Same link ignoring case, a trailing slash and surrounding spaces.
const sameUrl = (a?: string | null, b?: string | null) => {
  const norm = (u?: string | null) => (u || "").trim().replace(/\/+$/, "").toLowerCase();
  return !!a && !!b && norm(a) === norm(b);
};

// The separate apply/registration link — only when it is an http(s) URL that
// differs from the original post (same rule as the web), otherwise null.
export const applyLinkUrl = (l: Listing): string | null =>
  isHttpUrl(l.applyUrl) && !sameUrl(l.applyUrl, l.sourceUrl) ? l.applyUrl : null;

// The page the admin added the listing from, when it is http(s).
export const originalPostUrl = (l: Listing): string | null =>
  isHttpUrl(l.sourceUrl) ? l.sourceUrl : null;

// Where "Register" goes: the separate registration link while the event is
// still open for it, otherwise null.
export const registerUrl = (l: Listing): string | null => {
  const url = applyLinkUrl(l);
  if (!url || isPastEvent(l) || deadlineInfo(l.deadline)?.closed) return null;
  return url;
};

export const openLink = (url: string) =>
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open the link"));

// Small "Original post" link (always shown when the listing has an http(s)
// source URL).
export const OriginalPostLink: React.FC<{ listing: Listing; style?: any }> = ({ listing, style }) => {
  const { C } = useTheme();
  const url = originalPostUrl(listing);
  if (!url) return null;
  return (
    <Pressable onPress={() => openLink(url)} hitSlop={6} accessibilityRole="link"
      accessibilityLabel={`Original post for ${listing.title}`}
      style={[{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }, style]}>
      <ExternalLink color={C.navy} size={12} />
      <Text style={{ color: C.navy, fontSize: 12, fontWeight: "600" }}>Original post</Text>
    </Pressable>
  );
};
