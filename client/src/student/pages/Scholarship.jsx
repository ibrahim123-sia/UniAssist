import React from "react";
import ListingBrowser from "../components/ListingBrowser";

// Scholarships come only from links the admin scraped and published (GET /api/listings).
const Scholarship = () => <ListingBrowser kind="scholarship" />;

export default Scholarship;
