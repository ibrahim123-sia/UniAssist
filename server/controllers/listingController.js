import path from "path";
import mongoose from "mongoose";
import Listing, {
  LISTING_KINDS,
  LISTING_STATUSES,
  LISTING_LIMITS,
  POSTER_UPLOAD_PREFIX,
  isHttpUrl,
  isPosterUrl,
  isLocalPosterPath,
} from "../models/Listing.js";
import { LISTING_UPLOAD_DIR } from "../middlewares/upload.js";
import { deleteUpload } from "../services/fileStore.js";
import { extractListing, startExtractJob, getExtractJob } from "../services/pythonClient.js";
import { escapeRegex } from "../utils/regex.js";
import { withKeyLock } from "../utils/keyedLock.js";

// Every admin-editable field (besides `status`, handled separately).
const TEXT_FIELDS = [
  "title",
  "organization",
  "location",
  "description",
  "requirements",
  "applyUrl",
  "sourceUrl",
  "employmentType",
  "salary",
  "fundingType",
  "amount",
  "eligibility",
  "degreeLevel",
  "eventTime",
  "posterUrl",
];
const URL_FIELDS = new Set(["applyUrl", "sourceUrl"]);
const KIND_ERROR = "kind must be job, scholarship or event";

const parsePaging = (query, defaultLimit = 25) => ({
  limit: Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), 100),
  offset: Math.max(parseInt(query.offset) || 0, 0),
});

// "YYYY-MM-DD" → UTC midnight of that day; any other parseable date string
// (e.g. an ISO datetime for an event start) is accepted as-is. Returns
// undefined for garbage.
const parseDeadline = (value) => {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (m && date.getUTCDate() !== +m[3]) return undefined; // 2026-02-31
  return date;
};

// Today's calendar date (server-local) as UTC midnight, comparable with
// deadlines stored from "YYYY-MM-DD".
const startOfToday = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

// Earliest instant still counted as "today" for events: dates stored from
// "YYYY-MM-DD" are UTC midnight, datetimes are real instants — take whichever
// of the two midnights comes first so neither kind drops off a day early.
const startOfTodayForEvents = () => {
  const now = new Date();
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return new Date(Math.min(localMidnight.getTime(), startOfToday().getTime()));
};

const PUBLISH_EVENT_ERROR = "eventDate is required to publish an event";
const needsEventDate = (listing) =>
  listing.kind === "event" && listing.status === "published" && !listing.eventDate;

// Validate and pick the editable fields from an admin request body.
// Returns { fields } or { error }.
function pickListingFields(body) {
  const fields = {};
  for (const key of TEXT_FIELDS) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value === null || value === undefined) {
      fields[key] = null;
      continue;
    }
    if (typeof value !== "string") return { error: `${key} must be a string` };
    const trimmed = value.trim();
    if (trimmed.length > LISTING_LIMITS[key]) {
      return { error: `${key} must be at most ${LISTING_LIMITS[key]} characters` };
    }
    if (URL_FIELDS.has(key) && trimmed && !isHttpUrl(trimmed)) {
      return { error: `${key} must be an http(s) URL` };
    }
    if (key === "posterUrl" && trimmed && !isPosterUrl(trimmed)) {
      return { error: "posterUrl must be an http(s) URL or an uploaded poster" };
    }
    fields[key] = trimmed || null;
  }
  if ("deadline" in body) {
    const deadline = parseDeadline(body.deadline);
    if (deadline === undefined) return { error: "deadline must be a date (YYYY-MM-DD) or null" };
    fields.deadline = deadline;
  }
  for (const key of ["eventDate", "eventEndDate"]) {
    if (!(key in body) || body[key] === undefined) continue;
    const date = parseDeadline(body[key]);
    if (date === undefined) return { error: `${key} must be a date (YYYY-MM-DD or ISO 8601) or null` };
    fields[key] = date;
  }
  if ("kind" in body) {
    if (!LISTING_KINDS.includes(body.kind)) return { error: KIND_ERROR };
    fields.kind = body.kind;
  }
  if ("status" in body) {
    if (!LISTING_STATUSES.includes(body.status)) {
      return { error: "status must be draft, published or archived" };
    }
    fields.status = body.status;
  }
  return { fields };
}

// Another non-archived listing with the same link + kind, if any.
const findDuplicate = (kind, sourceUrl, excludeId) =>
  Listing.findOne({
    kind,
    sourceUrl,
    status: { $ne: "archived" },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

const duplicateResponse = (res, listing) =>
  res.status(409).json({
    success: false,
    message: "A listing from this link already exists",
    listing,
  });

// Remove an uploaded poster file (never anything outside uploads/listings).
const removeLocalPoster = (posterUrl) => {
  if (!isLocalPosterPath(posterUrl)) return;
  deleteUpload(path.join(LISTING_UPLOAD_DIR, path.basename(posterUrl.slice(POSTER_UPLOAD_PREFIX.length))));
};

const validationMessage = (error) =>
  Object.values(error.errors || {})[0]?.message || "Invalid listing";

// Python's extracted value → trimmed string capped to the schema limit, or null.
const cleanExtracted = (value, key) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, LISTING_LIMITS[key]) : null;
};

// Same link + kind is created one at a time (double clicks, a sync scrape
// racing a background one) so the duplicate check can't be raced.
const listingLockKey = (kind, sourceUrl) => `listing:${kind}:${sourceUrl}`;

// Remove a local poster file once no listing points at it any more.
const removePosterIfUnused = async (posterUrl) => {
  if (isLocalPosterPath(posterUrl) && !(await Listing.exists({ posterUrl }))) {
    removeLocalPoster(posterUrl);
  }
};

// Validate a scrape request body → { url, kind } or { error }.
function parseScrapeRequest(body) {
  const { url, kind } = body ?? {};
  if (typeof url !== "string" || !url.trim()) return { error: "url is required" };
  const requestedUrl = url.trim();
  if (requestedUrl.length > LISTING_LIMITS.sourceUrl || !isHttpUrl(requestedUrl)) {
    return { error: "url must be an http(s) URL" };
  }
  if (!LISTING_KINDS.includes(kind)) return { error: KIND_ERROR };
  return { url: requestedUrl, kind };
}

// Python's extraction result → a new draft listing. Shared by the sync scrape
// and the background scrape jobs. → { listing } or { duplicate } (the
// existing listing for the same final link). Throws ValidationError when the
// extracted data doesn't fit the schema.
async function saveExtractedListing(extracted, { kind, requestedUrl, adminId }) {
  const f = extracted.fields;
  const finalUrl = isHttpUrl(extracted.sourceUrl) ? extracted.sourceUrl.slice(0, LISTING_LIMITS.sourceUrl) : requestedUrl;

  return withKeyLock(listingLockKey(kind, finalUrl), async () => {
    // Python reports the URL after redirects — check again against that (and
    // against anything created while the page was being extracted).
    const existing = await findDuplicate(kind, finalUrl);
    if (existing) return { duplicate: existing };

    const applyUrl = cleanExtracted(f.applyUrl, "applyUrl");
    const deadline = typeof f.deadline === "string" ? parseDeadline(f.deadline) : null;
    const extractedDate = (value) => (typeof value === "string" ? parseDeadline(value) || null : null);
    const eventDate = extractedDate(f.eventDate);
    let eventEndDate = extractedDate(f.eventEndDate);
    if (eventDate && eventEndDate && eventEndDate < eventDate) eventEndDate = null;
    const posterUrl = cleanExtracted(f.posterUrl, "posterUrl");
    const title =
      cleanExtracted(f.title, "title") ||
      cleanExtracted(f.organization, "title") ||
      new URL(finalUrl).hostname;

    const listing = await Listing.create({
      kind,
      title,
      organization: cleanExtracted(f.organization, "organization"),
      location: cleanExtracted(f.location, "location"),
      deadline: deadline || null,
      description: cleanExtracted(f.description, "description"),
      requirements: cleanExtracted(f.requirements, "requirements"),
      applyUrl: applyUrl && isHttpUrl(applyUrl) ? applyUrl : finalUrl,
      sourceUrl: finalUrl,
      employmentType: cleanExtracted(f.employmentType, "employmentType"),
      salary: cleanExtracted(f.salary, "salary"),
      fundingType: cleanExtracted(f.fundingType, "fundingType"),
      amount: cleanExtracted(f.amount, "amount"),
      eligibility: cleanExtracted(f.eligibility, "eligibility"),
      degreeLevel: cleanExtracted(f.degreeLevel, "degreeLevel"),
      // Event fields (dropped by the model for other kinds).
      eventDate,
      eventEndDate,
      eventTime: cleanExtracted(f.eventTime, "eventTime"),
      posterUrl: posterUrl && isHttpUrl(posterUrl) ? posterUrl : null,
      status: "draft",
      extractedBy: extracted.extractedBy === "llm" ? "llm" : "heuristic",
      createdBy: adminId,
    });
    return { listing };
  });
}

// ---------------------------------------------------------------- admin

export const scrapeListing = async (req, res) => {
  try {
    const { url: requestedUrl, kind, error: inputError } = parseScrapeRequest(req.body);
    if (inputError) return res.status(400).json({ success: false, message: inputError });

    // Cheap pre-check so a re-scrape of the same link doesn't burn an LLM call.
    const preExisting = await findDuplicate(kind, requestedUrl);
    if (preExisting) return duplicateResponse(res, preExisting);

    let extracted;
    try {
      extracted = await extractListing(requestedUrl, kind);
    } catch (error) {
      const status = error.status || 502;
      if (status >= 500) console.error("scrapeListing: extraction failed:", error.message);
      return res.status(status).json({ success: false, message: error.message });
    }

    const { listing, duplicate } = await saveExtractedListing(extracted, {
      kind,
      requestedUrl,
      adminId: req.user._id,
    });
    if (duplicate) return duplicateResponse(res, duplicate);

    res.status(201).json({ success: true, listing });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(502).json({ success: false, message: `Extracted data was invalid: ${validationMessage(error)}` });
    }
    console.error("scrapeListing error:", error);
    res.status(500).json({ success: false, message: "Failed to scrape listing" });
  }
};

// ---------------------------------------------------------------- admin: scrape jobs
//
// Background variant of /scrape so the admin sees real progress: Python runs
// the extraction as a job (stages fetching → reading → extracting/fallback →
// done); Node polls Python whenever the admin polls, and creates the draft
// exactly once when Python reports done.

const SCRAPE_JOB_TTL_MS = 30 * 60 * 1000;
const MAX_SCRAPE_JOBS = 500;

export const SCRAPE_STAGE_LABELS = {
  queued: "Starting…",
  fetching: "Fetching the page…",
  reading: "Reading the page content…",
  extracting: "Extracting details with AI…",
  fallback: "AI unavailable — reading the page structure…",
  done: "Saving draft…",
  saved: "Draft ready",
};
const stageLabel = (stage) => SCRAPE_STAGE_LABELS[stage] || "Working…";

// jobId → { jobId, adminId, url, kind, listingId, createdAt, stage,
//           finishedAt, final: {status, listing, duplicate, error} | null,
//           saving: Promise | null }
const scrapeJobs = new Map();

const pruneScrapeJobs = () => {
  const cutoff = Date.now() - SCRAPE_JOB_TTL_MS;
  for (const [id, job] of scrapeJobs) {
    if (job.createdAt < cutoff) scrapeJobs.delete(id);
  }
  // Still too many → drop the oldest (Map iterates in insertion order).
  while (scrapeJobs.size >= MAX_SCRAPE_JOBS) scrapeJobs.delete(scrapeJobs.keys().next().value);
};

const jobView = (job) => {
  const final = job.final;
  const stage = final?.status === "done" ? "saved" : job.stage;
  return {
    jobId: job.jobId,
    status: final ? final.status : "running",
    stage,
    stageLabel: stageLabel(stage),
    elapsedMs: (job.finishedAt || Date.now()) - job.createdAt,
    listing: final?.listing || null,
    duplicate: final?.duplicate || null,
    error: final?.error || null,
  };
};

const finishJob = (job, final) => {
  job.final = final;
  job.finishedAt ??= Date.now();
};

// Python said done → create the draft once; concurrent polls share the same
// promise, so a job can never produce two drafts.
const saveJobResult = (job, result) => {
  job.saving ??= (async () => {
    try {
      if (!result || typeof result !== "object" || typeof result.fields !== "object" || !result.fields) {
        throw Object.assign(new Error("Extraction service returned an invalid response"), { status: 502 });
      }
      const { listing, duplicate } = await saveExtractedListing(result, {
        kind: job.kind,
        requestedUrl: job.url,
        adminId: job.adminId,
      });
      if (duplicate) {
        finishJob(job, {
          status: "failed",
          duplicate,
          error: { status: 409, message: "A listing from this link already exists" },
        });
      } else {
        job.listingId = listing._id;
        finishJob(job, { status: "done", listing });
      }
    } catch (error) {
      const message =
        error.name === "ValidationError"
          ? `Extracted data was invalid: ${validationMessage(error)}`
          : error.status
            ? error.message
            : "Failed to save the draft listing";
      if (!error.status && error.name !== "ValidationError") console.error("scrape job save error:", error);
      finishJob(job, { status: "failed", error: { status: error.status || 502, message } });
    }
  })();
  return job.saving;
};

// POST /api/admin/listings/scrape-jobs { url, kind } → 202 { jobId }
export const startScrapeJob = async (req, res) => {
  try {
    const { url, kind, error: inputError } = parseScrapeRequest(req.body);
    if (inputError) return res.status(400).json({ success: false, message: inputError });

    const preExisting = await findDuplicate(kind, url);
    if (preExisting) return duplicateResponse(res, preExisting);

    let jobId;
    try {
      jobId = await startExtractJob(url, kind);
    } catch (error) {
      const status = error.status || 502;
      if (status >= 500) console.error("startScrapeJob: could not start extraction:", error.message);
      return res.status(status).json({ success: false, message: error.message });
    }

    pruneScrapeJobs();
    scrapeJobs.set(jobId, {
      jobId,
      adminId: req.user._id,
      url,
      kind,
      listingId: null,
      createdAt: Date.now(),
      stage: "queued",
      finishedAt: null,
      final: null,
      saving: null,
    });
    res.status(202).json({ success: true, jobId });
  } catch (error) {
    console.error("startScrapeJob error:", error);
    res.status(500).json({ success: false, message: "Failed to start scraping" });
  }
};

// GET /api/admin/listings/scrape-jobs/:jobId — only for the admin who started it.
export const getScrapeJob = async (req, res) => {
  try {
    const job = scrapeJobs.get(String(req.params.jobId));
    if (!job || String(job.adminId) !== String(req.user._id) || Date.now() - job.createdAt > SCRAPE_JOB_TTL_MS) {
      return res.status(404).json({ success: false, message: "Scrape job not found" });
    }
    if (job.saving) await job.saving;
    if (job.final) return res.json({ success: true, job: jobView(job) });

    let remote;
    try {
      remote = await getExtractJob(job.jobId);
    } catch (error) {
      if (error.status === 404) {
        finishJob(job, {
          status: "failed",
          error: { status: 502, message: "The scrape job was lost (the AI service restarted). Please try again." },
        });
        return res.json({ success: true, job: jobView(job) });
      }
      // Python briefly unreachable: report the last known state; the admin
      // keeps polling.
      return res.json({ success: true, job: { ...jobView(job), warning: error.message } });
    }

    if (job.final) return res.json({ success: true, job: jobView(job) }); // finished meanwhile
    if (typeof remote.stage === "string" && remote.stage) job.stage = remote.stage;
    if (remote.status === "done") {
      job.stage = "done";
      await saveJobResult(job, remote.result);
    } else if (remote.status === "failed") {
      const status = Number.isInteger(remote.error?.status) ? remote.error.status : 502;
      const message =
        typeof remote.error?.message === "string" && remote.error.message.trim()
          ? remote.error.message.trim().slice(0, 500)
          : "Could not extract that page";
      finishJob(job, { status: "failed", error: { status, message } });
    }
    res.json({ success: true, job: jobView(job) });
  } catch (error) {
    console.error("getScrapeJob error:", error);
    res.status(500).json({ success: false, message: "Failed to load scrape job" });
  }
};

export const createListing = async (req, res) => {
  try {
    const { fields, error } = pickListingFields(req.body ?? {});
    if (error) return res.status(400).json({ success: false, message: error });
    if (!fields.kind) {
      return res.status(400).json({ success: false, message: KIND_ERROR });
    }
    if (!fields.title) return res.status(400).json({ success: false, message: "title is required" });
    // A hand-entered listing may have only an apply link — use it as the source.
    if (!fields.sourceUrl) fields.sourceUrl = fields.applyUrl;
    if (!fields.sourceUrl) {
      return res.status(400).json({ success: false, message: "sourceUrl or applyUrl is required" });
    }
    if (!fields.applyUrl) fields.applyUrl = fields.sourceUrl;

    const status = fields.status || "draft";
    if (needsEventDate({ ...fields, status })) {
      return res.status(400).json({ success: false, message: PUBLISH_EVENT_ERROR });
    }
    const { listing, duplicate } = await withKeyLock(listingLockKey(fields.kind, fields.sourceUrl), async () => {
      if (status !== "archived") {
        const existing = await findDuplicate(fields.kind, fields.sourceUrl);
        if (existing) return { duplicate: existing };
      }
      return {
        listing: await Listing.create({
          ...fields,
          status,
          extractedBy: "manual",
          createdBy: req.user._id,
          publishedAt: status === "published" ? new Date() : null,
        }),
      };
    });
    if (duplicate) return duplicateResponse(res, duplicate);
    res.status(201).json({ success: true, listing });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: validationMessage(error) });
    }
    console.error("createListing error:", error);
    res.status(500).json({ success: false, message: "Failed to create listing" });
  }
};

export const listAdminListings = async (req, res) => {
  try {
    const { kind, status, search } = req.query;
    const { limit, offset } = parsePaging(req.query);
    const filter = {};
    if (kind) {
      if (!LISTING_KINDS.includes(kind)) {
        return res.status(400).json({ success: false, message: KIND_ERROR });
      }
      filter.kind = kind;
    }
    if (status) {
      if (!LISTING_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }
      filter.status = status;
    }
    if (typeof search === "string" && search.trim()) {
      const pattern = escapeRegex(search.trim());
      filter.$or = [
        { title: { $regex: pattern, $options: "i" } },
        { organization: { $regex: pattern, $options: "i" } },
        { location: { $regex: pattern, $options: "i" } },
        { sourceUrl: { $regex: pattern, $options: "i" } },
      ];
    }
    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .populate("createdBy", "name email")
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit),
      Listing.countDocuments(filter),
    ]);
    res.json({ success: true, listings, total });
  } catch (error) {
    console.error("listAdminListings error:", error);
    res.status(500).json({ success: false, message: "Failed to load listings" });
  }
};

export const updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }
    const { fields, error } = pickListingFields(req.body ?? {});
    if (error) return res.status(400).json({ success: false, message: error });
    if ("title" in fields && !fields.title) {
      return res.status(400).json({ success: false, message: "title is required" });
    }
    if ("sourceUrl" in fields && !fields.sourceUrl) {
      return res.status(400).json({ success: false, message: "sourceUrl is required" });
    }

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });

    const wasPublished = listing.status === "published";
    const previousPoster = listing.posterUrl;
    listing.set(fields);
    if (listing.status === "published" && !wasPublished) listing.publishedAt = new Date();
    if (listing.status === "draft") listing.publishedAt = null;
    if (needsEventDate(listing)) {
      return res.status(400).json({ success: false, message: PUBLISH_EVENT_ERROR });
    }

    if (listing.status !== "archived" && (listing.isModified("kind") || listing.isModified("sourceUrl") || listing.isModified("status"))) {
      const existing = await findDuplicate(listing.kind, listing.sourceUrl, listing._id);
      if (existing) return duplicateResponse(res, existing);
    }

    await listing.save();
    // A replaced poster - or one dropped because the listing is no longer an
    // event (the model nulls event fields) - leaves no orphan upload behind.
    if (previousPoster && previousPoster !== listing.posterUrl) {
      removePosterIfUnused(previousPoster).catch(() => {});
    }
    res.json({ success: true, listing });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: validationMessage(error) });
    }
    console.error("updateListing error:", error);
    res.status(500).json({ success: false, message: "Failed to update listing" });
  }
};

export const deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }
    const deleted = await Listing.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Listing not found" });
    // A poster uploaded for this listing goes with it (unless another listing
    // still points at the same file).
    await removePosterIfUnused(deleted.posterUrl);
    res.json({ success: true });
  } catch (error) {
    console.error("deleteListing error:", error);
    res.status(500).json({ success: false, message: "Failed to delete listing" });
  }
};

// POST /api/admin/listings/poster (multipart, field `poster`) — the admin then
// saves the returned url as the event's posterUrl.
export const uploadListingPoster = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'A poster image (field "poster") is required' });
  }
  res.status(201).json({ success: true, url: `${POSTER_UPLOAD_PREFIX}${req.file.filename}` });
};

// ---------------------------------------------------------------- student

// Internal bookkeeping students don't need.
const PUBLIC_PROJECTION = { createdBy: 0, extractedBy: 0, __v: 0 };

const searchClause = (search) => {
  if (typeof search !== "string" || !search.trim()) return null;
  const pattern = escapeRegex(search.trim());
  return {
    $or: [
      { title: { $regex: pattern, $options: "i" } },
      { organization: { $regex: pattern, $options: "i" } },
      { location: { $regex: pattern, $options: "i" } },
      { description: { $regex: pattern, $options: "i" } },
    ],
  };
};

// Events: upcoming ones (still running today) soonest first; with
// includePast=true every event, latest first; with past=true only events
// that have already ended, latest first (the student "Past" tab).
async function listPublishedEvents(req, res) {
  const { search, includePast } = req.query;
  const { limit, offset } = parsePaging(req.query, 50);
  const filter = { status: "published", kind: "event" };
  const onlyPast = req.query.past === "true";
  const past = onlyPast || includePast === "true";
  const today = startOfTodayForEvents();
  if (onlyPast) {
    filter.$or = [
      { eventEndDate: { $lt: today } },
      { eventEndDate: null, eventDate: { $lt: today } },
    ];
  } else if (!past) {
    filter.$or = [
      { eventEndDate: { $gte: today } },
      { eventEndDate: null, eventDate: { $gte: today } },
    ];
  }
  const text = searchClause(search);
  if (text) filter.$and = [text];

  const order = past ? -1 : 1;
  const [listings, total] = await Promise.all([
    Listing.find(filter)
      .select(PUBLIC_PROJECTION)
      .sort({ eventDate: order, publishedAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit),
    Listing.countDocuments(filter),
  ]);
  res.json({ success: true, listings, total });
}

export const listPublishedListings = async (req, res) => {
  try {
    const { kind, search, includeExpired } = req.query;
    if (kind === "event") return await listPublishedEvents(req, res);
    const { limit, offset } = parsePaging(req.query, 50);
    // Without a kind the deadline feed covers jobs + scholarships; events have
    // their own feed (?kind=event).
    const filter = { status: "published", kind: { $in: ["job", "scholarship"] } };
    if (kind) {
      if (!LISTING_KINDS.includes(kind)) {
        return res.status(400).json({ success: false, message: KIND_ERROR });
      }
      filter.kind = kind;
    }
    const today = startOfToday();
    if (includeExpired !== "true") {
      filter.$or = [{ deadline: null }, { deadline: { $gte: today } }];
    }
    const text = searchClause(search);
    if (text) filter.$and = [text];

    // Order: upcoming deadlines (soonest first), then open-ended listings,
    // then (only with includeExpired) closed ones, most recently closed first.
    // Ties → newest publishedAt.
    const todayMs = today.getTime();
    const [listings, total] = await Promise.all([
      Listing.aggregate([
        { $match: filter },
        {
          $addFields: {
            _group: {
              $cond: [
                { $eq: [{ $ifNull: ["$deadline", null] }, null] },
                1,
                { $cond: [{ $gte: [{ $toLong: "$deadline" }, todayMs] }, 0, 2] },
              ],
            },
            _deadlineKey: {
              $cond: [
                { $eq: [{ $ifNull: ["$deadline", null] }, null] },
                0,
                {
                  $cond: [
                    { $gte: [{ $toLong: "$deadline" }, todayMs] },
                    { $toLong: "$deadline" },
                    { $multiply: [{ $toLong: "$deadline" }, -1] },
                  ],
                },
              ],
            },
          },
        },
        { $sort: { _group: 1, _deadlineKey: 1, publishedAt: -1, _id: -1 } },
        { $skip: offset },
        { $limit: limit },
        { $project: { ...PUBLIC_PROJECTION, _group: 0, _deadlineKey: 0 } },
      ]),
      Listing.countDocuments(filter),
    ]);
    res.json({ success: true, listings, total });
  } catch (error) {
    console.error("listPublishedListings error:", error);
    res.status(500).json({ success: false, message: "Failed to load listings" });
  }
};

export const getPublishedListing = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }
    const listing = await Listing.findOne({ _id: id, status: "published" }).select(PUBLIC_PROJECTION);
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });
    res.json({ success: true, listing });
  } catch (error) {
    console.error("getPublishedListing error:", error);
    res.status(500).json({ success: false, message: "Failed to load listing" });
  }
};
