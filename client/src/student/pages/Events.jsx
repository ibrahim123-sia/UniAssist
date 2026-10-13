import React from "react";
import ListingBrowser from "../components/ListingBrowser";

// Events come only from links the admin scraped (or entered) and published
// (GET /api/listings?kind=event) — Upcoming by default, Past (`past=true`) tab.
const Events = () => <ListingBrowser kind="event" />;

export default Events;
