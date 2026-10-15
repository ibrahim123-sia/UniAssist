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

// Deadline / event-date chip colors by tone (status tokens; closed = neutral).
const TONE_CLASSES = {
  closed: "bg-surface-muted text-muted border-border-strong",
  urgent: "bg-danger-bg text-danger border-danger-border",
  soon: "bg-warning-bg text-warning border-warning-border",
  open: "bg-success-bg text-success border-success-border",
};
const toneClasses = (tone) => TONE_CLASSES[tone] || TONE_CLASSES.closed;

const tagsFor = (l, kind) =>
  ((l.kind || kind) === "scholarship"
    ? [l.fundingType, l.amount, l.degreeLevel]
    : [l.employmentType, l.salary]
  ).filter(Boolean);

const DeadlineChip = ({ deadline }) => {
  const info = deadlineInfo(deadline);
  if (!info) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${toneClasses(info.tone)}`}
    >
      {info.label}
    </span>
  );
};

const EventChip = ({ info }) => {
  if (!info) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${toneClasses(info.tone)}`}
    >
      {info.label}
    </span>
  );
};

// Calendar-page style badge (month over day) used when there's no poster.
const DateBadge = ({ info, large = false }) => (
  <div
    className={`${large ? "w-16 h-16" : "w-14 h-14"} rounded-control border border-border bg-surface-muted flex flex-col items-center justify-center shrink-0 leading-none`}
  >
    {info ? (
      <>
        <span className="text-[10px] font-bold uppercase tracking-wide text-primary dark:text-link">
          {info.start.format("MMM")}
        </span>
        <span className={`${large ? "text-2xl" : "text-xl"} font-extrabold mt-1 text-heading`}>
          {info.start.format("D")}
        </span>
      </>
    ) : (
      <CalendarDays className="w-5 h-5 text-muted" />
    )}
  </div>
);

// Poster image that quietly falls back to the date badge if it fails to load.
const Poster = ({ url, info, className }) => {
  const [failed, setFailed] = useState(false);
  const src = posterSrc(url);
  if (!src || failed) return <DateBadge info={info} />;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`bg-surface-muted ${className}`}
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

const Section = ({ title, text }) =>
  text ? (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide mb-1 text-muted">
        {title}
      </h4>
      <p className="text-sm whitespace-pre-wrap wrap-break-word text-text">
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
    <div className="h-full overflow-y-auto bg-bg text-text">
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-extrabold text-heading">
            {labels.many}
          </h1>
          <p className="text-sm mt-1 text-muted">
            {copy.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={copy.search}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-control border bg-input-bg border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
            />
          </div>
          {isEvent ? (
            <div
              className="inline-flex rounded-control border border-border-strong bg-surface p-0.5 text-sm"
              role="tablist"
              aria-label="Which events"
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
                    className={`px-3 py-1 rounded-[9px] font-semibold transition-colors focus-ring ${
                      active ? "bg-primary text-on-primary" : "text-label hover:bg-nav-hover"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm cursor-pointer text-muted">
              <input
                type="checkbox"
                checked={showOld}
                onChange={(e) => setShowOld(e.target.checked)}
                className="accent-primary"
              />
              Show closed
            </label>
          )}
          <button
            onClick={reload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-surface border border-border-strong text-label hover:bg-nav-hover focus-ring transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {error && items.length === 0 ? (
          <div
            className="text-center py-12 border border-border bg-surface rounded-card shadow-card"
          >
            <p className="text-sm text-danger">
              {error}
            </p>
            <button onClick={reload} className="mt-3 text-sm font-semibold text-link hover:text-link-hover focus-ring rounded">
              Try again
            </button>
          </div>
        ) : !loaded || (loading && items.length === 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 border animate-pulse bg-surface border-border rounded-card shadow-card"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div
            className="text-center py-16 border border-border bg-surface rounded-card shadow-card"
          >
            <EmptyIcon className="w-12 h-12 mx-auto mb-3 text-muted" />
            <p className="text-base font-bold text-heading">
              {search
                ? `No ${labels.many.toLowerCase()} match “${search}”.`
                : isEvent && !showOld
                ? "No upcoming events right now."
                : isEvent
                ? "No past events yet."
                : `No ${labels.many.toLowerCase()} posted yet.`}
            </p>
            <p className="text-sm mt-1 text-muted">
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
                      className="text-left p-3 rounded-card border border-border bg-surface shadow-card transition-colors hover:border-border-strong hover:bg-row-hover focus-ring flex gap-3"
                      style={{ opacity: info?.past ? 0.7 : 1 }}
                    >
                      <Poster
                        url={l.posterUrl}
                        info={info}
                       
                        className="w-20 h-24 sm:w-24 sm:h-28 rounded-control object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold line-clamp-2 text-heading">
                            {l.title}
                          </h3>
                          <EventChip info={info} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <EventMeta l={l} info={info} />
                        </div>
                        {l.description && (
                          <p className="text-sm line-clamp-2 text-muted">
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
                    className="text-left p-4 rounded-card border border-border bg-surface shadow-card transition-colors hover:border-border-strong hover:bg-row-hover focus-ring flex flex-col gap-2"
                    style={{ opacity: dl?.tone === "closed" ? 0.7 : 1 }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold line-clamp-2 text-heading">
                        {l.title}
                      </h3>
                      <DeadlineChip deadline={l.deadline} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
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
                      <p className="text-sm line-clamp-2 text-muted">
                        {l.description}
                      </p>
                    )}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-0.5 rounded-full border border-border-strong text-xs bg-surface dark:bg-transparent text-pill"
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
                  className="px-4 py-2 text-sm font-semibold rounded-control disabled:opacity-50 bg-surface border border-border-strong text-label hover:bg-nav-hover focus-ring transition-colors"
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
                  className="px-3 py-2 text-sm font-semibold rounded-control inline-flex items-center gap-1.5 bg-surface border border-border-strong text-label hover:bg-nav-hover focus-ring transition-colors"
                >
                  Original post <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {applyUrl && (
                <a
                  href={applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm inline-flex items-center gap-1.5 rounded-control font-bold bg-primary text-on-primary hover:bg-primary-hover focus-ring transition-colors"
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
               
                className="w-full max-h-[420px] rounded-control object-contain"
              />
            )}
            <div className="flex items-start gap-3">
              {!posterSrc(selected.posterUrl) && <DateBadge info={selectedEvent} large />}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm min-w-0 text-muted">
                <EventMeta l={selected} info={selectedEvent} size="md" />
                <EventChip info={selectedEvent} />
              </div>
            </div>
            {selectedRegistration && (
              <p className="text-sm inline-flex flex-wrap items-center gap-1.5 text-muted">
                Registration deadline: <span className="text-text">{selectedRegistration.date}</span>
                <DeadlineChip deadline={selected.deadline} />
              </p>
            )}
            <Section title="About this event" text={selected.description} />
          </div>
        )}
        {selected && !isEvent && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
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
                  <DeadlineChip deadline={selected.deadline} />
                </span>
              )}
            </div>
            {tagsFor(selected, kind).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tagsFor(selected, kind).map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-0.5 rounded-full border border-border-strong text-xs bg-surface dark:bg-transparent text-pill"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <Section title="Description" text={selected.description} />
            <Section title="Requirements" text={selected.requirements} />
            <Section title="Eligibility" text={selected.eligibility} />
          </div>
        )}
      </AdminModal>
    </div>
  );
};

export default ListingBrowser;
