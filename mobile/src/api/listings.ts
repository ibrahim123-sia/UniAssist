import client from "./client";

export type ListingKind = "job" | "scholarship" | "event";

// Shape of a published Listing from GET /api/listings (admin-scraped or
// manually entered on the web admin "Listings" page).
export interface Listing {
  _id: string;
  kind: ListingKind;
  title: string;
  organization?: string | null;
  location?: string | null;
  deadline?: string | null;
  description?: string | null;
  requirements?: string | null;
  applyUrl?: string | null;
  sourceUrl: string;
  // job only
  employmentType?: string | null;
  salary?: string | null;
  // scholarship only
  fundingType?: string | null;
  amount?: string | null;
  eligibility?: string | null;
  degreeLevel?: string | null;
  // event only: organization = organizer, location = venue, applyUrl =
  // registration link, deadline = registration deadline.
  eventDate?: string | null;
  eventEndDate?: string | null;
  // Free text, e.g. "10:00 AM – 1:00 PM".
  eventTime?: string | null;
  // http(s) URL or a server-relative upload ("/uploads/listings/...").
  posterUrl?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
}

export const apiListListings = (params: {
  kind: ListingKind;
  search?: string;
  limit?: number;
  offset?: number;
  // Jobs/scholarships only: closed deadlines are hidden unless this is set
  // ("Show closed" — same flag as the web).
  includeExpired?: boolean;
  // Events only: by default the server returns upcoming/ongoing events
  // (soonest first); `past` returns only ended events, most recent first.
  past?: boolean;
}) => client.get("/api/listings", { params });
