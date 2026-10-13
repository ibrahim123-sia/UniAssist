import express from "express";
import { protect } from "../middlewares/auth.js";
import { listPublishedListings, getPublishedListing } from "../controllers/listingController.js";

// Student-facing jobs + scholarships feed (published listings only). Admin
// management lives under /api/admin/listings.
const router = express.Router();

router.use(protect);
router.get("/", listPublishedListings);
router.get("/:id", getPublishedListing);

export default router;
