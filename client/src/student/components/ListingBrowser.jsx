import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Search,
  MapPin,
  Calendar,
  Building2,
  ExternalLink,
  Briefcase,
  GraduationCap,
  RefreshCw,
  CalendarDays,
  Clock,
} from "lucide-react";
import { fetchListings } from "../../redux/slices/listingSlice";
import AdminModal from "../../administrator/components/AdminModal";
import { getPalette } from "../../administrator/utils/palette";
import { useDebouncedSearch } from "../../administrator/utils/useDebouncedSearch";
import { KIND_LABELS, deadlineInfo, eventInfo, posterSrc, safeHref, sameUrl } from "../../utils/listings";

const PAGE_SIZE = 20;

const COPY = {
  job: {
    subtitle: "Openings shared by the university",
    search: "Search jobs by title, company or location...",
    icon: Briefcase,
  },
  scholarship: {
    subtitle: "Scholarships and funding shared by the university",
    search: "Search scholarships...",
    icon: GraduationCap,
  },
  event: {
    subtitle: "Events, workshops and seminars shared by the university",
    search: "Search events by title, organizer or venue...",
    icon: CalendarDays,
  },
};

const toneColor = (tone, C) =>
  ({ closed: C.muted, urgent: C.red, soon: C.amber, open: C.green })[tone] || C.muted;

const tagsFor = (l, kind) =>
  ((l.kind || kind) === "scholarship"
    ? [l.fundingType, l.amount, l.degreeLevel]
    : [l.employmentType, l.salary]
  ).filter(Boolean);

const DeadlineChip = ({ deadline, C }) => {
  const info = deadlineInfo(deadline);
  if (!info) return null;
  const color = toneColor(info.tone, C);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      {info.label}
    </span>
  );
};

const EventChip = ({ info, C }) => {
  if (!info) return null;
  const color = toneColor(info.tone, C);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      {info.label}
    </span>
  );
};

// Calendar-page style badge (month over day) used when there's no poster.
const DateBadge = ({ info, C, large = false }) => (
  <div
    className={`${large ? "w-16 h-16" : "w-14 h-14"} rounded-lg border flex flex-col items-center justify-center shrink-0 leading-none`}
    style={{ borderColor: C.border, backgroundColor: C.surfaceAlt }}
  >
    {info ? (
      <>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.red }}>
          {info.start.format("MMM")}
        </span>
        <span className={`${large ? "text-2xl" : "text-xl"} font-bold mt-1`} style={{ color: C.text }}>
          {info.start.format("D")}
        </span>
      </>
    ) : (
      <CalendarDays className="w-5 h-5" style={{ color: C.muted }} />
    )}
  </div>
);

// Poster image that quietly falls back to the date badge if it fails to load.
const Poster = ({ url, info, C, className }) => {
  const [failed, setFailed] = useState(false);
  const src = posterSrc(url);
  if (!src || failed) return <DateBadge info={info} C={C} />;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
      style={{ backgroundColor: C.surfaceAlt }}
    />
  );
};

const EventMeta = ({ l, info, size = "sm" }) => {
  const icon = size === "sm" ? "w-3.5 h-3.5 shrink-0" : "w-4 h-4 shrink-0";
  return (
    <>
      {info && (
        <span className="inline-flex items-center gap-1">
          <Calendar className={icon} />
          {info.range}
        </span>
      )}
      {l.eventTime && (
        <span className="inline-flex items-center gap-1">
          <Clock className={icon} />
          {l.eventTime}
        </span>
      )}
      {l.location && (
        <span className="inline-flex items-center gap-1 min-w-0">
          <MapPin className={icon} />
          <span className="truncate">{l.location}</span>
        </span>
      )}
      {l.organization && (
        <span className="inline-flex items-center gap-1 min-w-0">
          <Building2 className={icon} />
          <span className="truncate">{l.organization}</span>
        </span>
      )}
    </>
  );
};

const Section = ({ title, text, C }) =>
  text ? (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
        {title}
      </h4>
      <p className="text-sm whitespace-pre-wrap wrap-break-word" style={{ color: C.text }}>
        {text}
      </p>
    </section>
  ) : null;

// Events: Upcoming (default) / Past (`past=true` → past only). Jobs and
// scholarships: "Show closed" (`includeExpired=true`).
const feedQuery = (kind, search, showOld, offset) => ({
  kind,
  search,
  ...(kind === "event" ? { past: showOld } : { includeExpired: showOld }),
  limit: PAGE_SIZE,
  offset,
});

// Student-facing list of admin-published jobs, scholarships or events.
const ListingBrowser = ({ kind }) => {
  const dispatch = useDispatch();
  const theme = useSelector((s) => s.theme.theme);
  const C = getPalette(theme === "dark");
  const bg = theme === "dark" ? "#0E1422" : "#F2F3F8";
  const feed = useSelector((s) => s.listing[kind]);
  const { input, setInput, search } = useDebouncedSearch();
  // Jobs/scholarships: "Show closed" deadlines. Events: the Past tab.
  const [showOld, setShowOld] = useState(false);
  const [selected, setSelected] = useState(null);

  const isEvent = kind === "event";
  const labels = KIND_LABELS[kind];
  const copy = COPY[kind];
  const EmptyIcon = copy.icon;

  useEffect(() => {
    dispatch(fetchListings(feedQuery(kind, search, showOld, 0)));
  }, [dispatch, kind, search, showOld]);

  const reload = () => dispatch(fetchListings(feedQuery(kind, search, showOld, 0)));
  const loadMore = () =>
    dispatch(fetchListings(feedQuery(kind, search, showOld, feed.items.length)));

  const { items, total, loading, error, loaded } = feed;
  // "Original post" always links the scraped page; Apply/Register only shows
  // for a separate application/registration link (not the same page again).
  const sourceHref = safeHref(selected?.sourceUrl);
  const applyCandidate = safeHref(selected?.applyUrl);
  const applyUrl = applyCandidate && !sameUrl(applyCandidate, sourceHref) ? applyCandidate : null;
  const selectedEvent = isEvent && selected ? eventInfo(selected) : null;
  const selectedRegistration = isEvent && selected ? deadlineInfo(selected.deadline) : null;

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: bg, color: C.text }}>
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>
            {labels.many}
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {copy.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={copy.search}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ backgroundColor: C.surface, borderColor: C.border, color: C.text }}
            />
          </div>
          {isEvent ? (
            <div
              className="inline-flex rounded-lg border p-0.5 text-sm"
              role="tablist"
              aria-label="Which events"
              style={{ borderColor: C.border, backgroundColor: C.surface }}
            >
              {[
                { value: false, label: "Upcoming" },
                { value: true, label: "Past" },
              ].map((opt) => {
                const active = showOld === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setShowOld(opt.value)}
                    className="px-3 py-1 rounded-md font-medium transition-colors"
                    style={{
                      backgroundColor: active ? C.navy : "transparent",
                      color: active ? "#FFFFFF" : C.muted,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.muted }}>
              <input
                type="checkbox"
                checked={showOld}
                onChange={(e) => setShowOld(e.target.checked)}
                style={{ accentColor: C.navy }}
              />
              Show closed
            </label>
          )}
          <button
            onClick={reload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border"
            style={{ borderColor: C.border, color: C.muted }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {error && items.length === 0 ? (
          <div
            className="text-center py-12 rounded-xl border"
            style={{ borderColor: C.border, backgroundColor: C.surface }}
          >
            <p className="text-sm" style={{ color: C.danger }}>
              {error}
            </p>
            <button onClick={reload} className="mt-3 text-sm font-medium" style={{ color: C.navy }}>
              Try again
            </button>
          </div>
        ) : !loaded || (loading && items.length === 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl border animate-pulse"
                style={{ backgroundColor: C.surface, borderColor: C.border }}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div
            className="text-center py-16 rounded-xl border"
            style={{ borderColor: C.border, backgroundColor: C.surface }}
          >
            <EmptyIcon className="w-12 h-12 mx-auto mb-3" style={{ color: C.muted }} />
            <p className="text-base font-medium" style={{ color: C.text }}>
              {search
                ? `No ${labels.many.toLowerCase()} match “${search}”.`
                : isEvent && !showOld
                ? "No upcoming events right now."
                : isEvent
                ? "No past events yet."
                : `No ${labels.many.toLowerCase()} posted yet.`}
            </p>
            <p className="text-sm mt-1" style={{ color: C.muted }}>
              {search
                ? "Try a different search."
                : "Check back later — new ones appear here as soon as they're published."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((l) => {
                if (isEvent) {
                  const info = eventInfo(l);
                  return (
                    <button
                      key={l._id}
                      onClick={() => setSelected(l)}
                      className="text-left p-3 rounded-xl border transition-all hover:shadow-md flex gap-3"
                      style={{
                        backgroundColor: C.surface,
                        borderColor: C.border,
                        opacity: info?.past ? 0.7 : 1,
                      }}
                    >
                      <Poster
                        url={l.posterUrl}
                        info={info}
                        C={C}
                        className="w-20 h-24 sm:w-24 sm:h-28 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold line-clamp-2" style={{ color: C.text }}>
                            {l.title}
                          </h3>
                          <EventChip info={info} C={C} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: C.muted }}>
                          <EventMeta l={l} info={info} />
                        </div>
                        {l.description && (
                          <p className="text-sm line-clamp-2" style={{ color: C.muted }}>
                            {l.description}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                }
                const tags = tagsFor(l, kind);
                const dl = deadlineInfo(l.deadline);
                return (
                  <button
                    key={l._id}
                    onClick={() => setSelected(l)}
                    className="text-left p-4 rounded-xl border transition-all hover:shadow-md flex flex-col gap-2"
                    style={{
                      backgroundColor: C.surface,
                      borderColor: C.border,
                      opacity: dl?.tone === "closed" ? 0.7 : 1,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold line-clamp-2" style={{ color: C.text }}>
                        {l.title}
                      </h3>
                      <DeadlineChip deadline={l.deadline} C={C} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: C.muted }}>
                      {l.organization && (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{l.organization}</span>
                        </span>
                      )}
                      {l.location && (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{l.location}</span>
                        </span>
                      )}
                      {dl && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {dl.date}
                        </span>
                      )}
                    </div>
                    {l.description && (
                      <p className="text-sm line-clamp-2" style={{ color: C.muted }}>
                        {l.description}
                      </p>
                    )}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-md text-xs"
                            style={{ backgroundColor: C.surfaceAlt, color: C.text }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {items.length < total && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50"
                  style={{ borderColor: C.border, color: C.text, backgroundColor: C.surface }}
                >
                  {loading ? "Loading..." : `Load more (${total - items.length} left)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <AdminModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || labels.one}
        size="lg"
        footer={
          selected && (
            <>
              {sourceHref && (
                <a
                  href={sourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-sm rounded-lg border inline-flex items-center gap-1.5"
                  style={{ borderColor: C.border, color: C.text }}
                >
                  Original post <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {applyUrl && (
                <a
                  href={applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm rounded-lg font-medium text-white inline-flex items-center gap-1.5"
                  style={{ backgroundColor: C.navy }}
                >
                  {isEvent ? "Register" : "Apply"} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </>
          )
        }
      >
        {selected && isEvent && (
          <div className="space-y-4">
            {posterSrc(selected.posterUrl) && (
              <Poster
                url={selected.posterUrl}
                info={selectedEvent}
                C={C}
                className="w-full max-h-[420px] rounded-lg object-contain"
              />
            )}
            <div className="flex items-start gap-3">
              {!posterSrc(selected.posterUrl) && <DateBadge info={selectedEvent} C={C} large />}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm min-w-0" style={{ color: C.muted }}>
                <EventMeta l={selected} info={selectedEvent} size="md" />
                <EventChip info={selectedEvent} C={C} />
              </div>
            </div>
            {selectedRegistration && (
              <p className="text-sm inline-flex flex-wrap items-center gap-1.5" style={{ color: C.muted }}>
                Registration deadline: <span style={{ color: C.text }}>{selectedRegistration.date}</span>
                <DeadlineChip deadline={selected.deadline} C={C} />
              </p>
            )}
            <Section title="About this event" text={selected.description} C={C} />
          </div>
        )}
        {selected && !isEvent && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm" style={{ color: C.muted }}>
              {selected.organization && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-4 h-4" /> {selected.organization}
                </span>
              )}
              {selected.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {selected.location}
                </span>
              )}
              {selected.deadline && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> {deadlineInfo(selected.deadline)?.date}
                  <DeadlineChip deadline={selected.deadline} C={C} />
                </span>
              )}
            </div>
            {tagsFor(selected, kind).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tagsFor(selected, kind).map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-md text-xs"
                    style={{ backgroundColor: C.surfaceAlt, color: C.text }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <Section title="Description" text={selected.description} C={C} />
            <Section title="Requirements" text={selected.requirements} C={C} />
            <Section title="Eligibility" text={selected.eligibility} C={C} />
          </div>
        )}
      </AdminModal>
    </div>
  );
};

export default ListingBrowser;
