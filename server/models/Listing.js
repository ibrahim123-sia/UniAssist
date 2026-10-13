import mongoose from "mongoose";

// Jobs, scholarships and events posted by the admin — scraped from a link
// (Python /listings/extract) or entered by hand. Students only ever see
// `published`.

export const LISTING_KINDS = ["job", "scholarship", "event"];
export const LISTING_STATUSES = ["draft", "published", "archived"];
export const EXTRACTED_BY = ["llm", "heuristic", "manual"];

// Max lengths shared by the schema and the controller's input trimming.
export const LISTING_LIMITS = {
  title: 200,
  organization: 200,
  location: 200,
  description: 5000,
  requirements: 3000,
  applyUrl: 2000,
  sourceUrl: 2000,
  employmentType: 100,
  salary: 200,
  fundingType: 100,
  amount: 200,
  eligibility: 3000,
  degreeLevel: 100,
  eventTime: 100,
  posterUrl: 2000,
};

// Event-only fields; forced to null for jobs/scholarships.
export const EVENT_FIELDS = ["eventDate", "eventEndDate", "eventTime", "posterUrl"];

// Where uploaded event posters are served from (see middlewares/upload.js).
export const POSTER_UPLOAD_PREFIX = "/uploads/listings/";

export const isHttpUrl = (value) => {
  if (typeof value !== "string" || !value) return false;
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && Boolean(u.hostname);
  } catch {
    return false;
  }
};

// A poster is either an external http(s) image or one uploaded through
// POST /api/admin/listings/poster (a bare file name under /uploads/listings/).
export const isLocalPosterPath = (value) =>
  typeof value === "string" &&
  value.startsWith(POSTER_UPLOAD_PREFIX) &&
  /^[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(value.slice(POSTER_UPLOAD_PREFIX.length));

export const isPosterUrl = (value) => isHttpUrl(value) || isLocalPosterPath(value);

const optionalString = (field) => ({
  type: String,
  trim: true,
  default: null,
  maxlength: [LISTING_LIMITS[field], `${field} must be at most ${LISTING_LIMITS[field]} characters`],
});

const urlValidator = {
  validator: (v) => v === null || v === undefined || v === "" || isHttpUrl(v),
  message: (props) => `${props.path} must be an http(s) URL`,
};

const listingSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: LISTING_KINDS, required: true, index: true },
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true,
      maxlength: [LISTING_LIMITS.title, `title must be at most ${LISTING_LIMITS.title} characters`],
    },
    organization: optionalString("organization"),
    location: optionalString("location"),
    deadline: { type: Date, default: null },
    description: optionalString("description"),
    requirements: optionalString("requirements"),
    applyUrl: { ...optionalString("applyUrl"), validate: urlValidator },
    sourceUrl: {
      type: String,
      required: [true, "sourceUrl is required"],
      trim: true,
      maxlength: [LISTING_LIMITS.sourceUrl, `sourceUrl must be at most ${LISTING_LIMITS.sourceUrl} characters`],
      validate: urlValidator,
    },
    // Job only
    employmentType: optionalString("employmentType"),
    salary: optionalString("salary"),
    // Scholarship only
    fundingType: optionalString("fundingType"),
    amount: optionalString("amount"),
    eligibility: optionalString("eligibility"),
    degreeLevel: optionalString("degreeLevel"),
    // Event only. `organization` = organizer, `location` = venue ("Online"
    // allowed), `applyUrl` = registration link, `deadline` = registration
    // deadline (optional).
    eventDate: { type: Date, default: null },
    eventEndDate: {
      type: Date,
      default: null,
      validate: {
        validator: function (v) {
          return !v || !this.eventDate || v.getTime() >= this.eventDate.getTime();
        },
        message: "eventEndDate must be on or after eventDate",
      },
    },
    eventTime: optionalString("eventTime"),
    posterUrl: {
      ...optionalString("posterUrl"),
      validate: {
        validator: (v) => v === null || v === undefined || v === "" || isPosterUrl(v),
        message: "posterUrl must be an http(s) URL or an uploaded poster",
      },
    },

    status: { type: String, enum: LISTING_STATUSES, default: "draft", index: true },
    extractedBy: { type: String, enum: EXTRACTED_BY, default: "manual" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Event fields only make sense on events.
listingSchema.pre("validate", function () {
  if (this.kind !== "event") {
    for (const key of EVENT_FIELDS) {
      if (this[key] !== null && this[key] !== undefined) this[key] = null;
    }
  }
});

// Duplicate detection (same link + kind) and the student feeds.
listingSchema.index({ kind: 1, sourceUrl: 1 });
listingSchema.index({ status: 1, kind: 1, deadline: 1 });
listingSchema.index({ status: 1, kind: 1, eventDate: 1 });

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
