import React from "react";
import ListingBrowser from "../components/ListingBrowser";

// Jobs come only from links the admin scraped and published (GET /api/listings).
const Jobs = () => <ListingBrowser kind="job" />;

export default Jobs;
