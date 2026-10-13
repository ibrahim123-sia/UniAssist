import multer from "multer";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// Paths are fixed (not env-configurable): the stored URLs and the static
// route in server.js both assume uploads/issues, uploads/avatars and
// uploads/listings.
export const UPLOAD_ROOT = "uploads";
const ISSUE_UPLOAD_DIR = `${UPLOAD_ROOT}/issues`;
const AVATAR_UPLOAD_DIR = `${UPLOAD_ROOT}/avatars`;
export const LISTING_UPLOAD_DIR = `${UPLOAD_ROOT}/listings`;

for (const dir of [ISSUE_UPLOAD_DIR, AVATAR_UPLOAD_DIR, LISTING_UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Exact allow-list. The stored extension comes from this map, never from the
// client's filename, so nothing like .html/.svg can end up being served from
// the API origin (stored XSS).
const IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};
const ISSUE_TYPES = { ...IMAGE_TYPES, "application/pdf": ".pdf" };
const POSTER_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const MAX_ISSUE_FILE_MB = 5;
const MAX_AVATAR_FILE_MB = 2;
const MAX_POSTER_FILE_MB = 3;

const storageFor = (dir, types) =>
  multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${types[file.mimetype]}`),
  });

const filterFor = (types, message) => (req, file, cb) => {
  if (types[file.mimetype]) cb(null, true);
  else cb(new Error(message), false);
};

export const issueUpload = multer({
  storage: storageFor(ISSUE_UPLOAD_DIR, ISSUE_TYPES),
  fileFilter: filterFor(ISSUE_TYPES, "Only PDF, JPG, PNG, GIF or WebP files are allowed."),
  limits: {
    fileSize: MAX_ISSUE_FILE_MB * 1024 * 1024,
    files: 3,
  },
});

export const avatarUpload = multer({
  storage: storageFor(AVATAR_UPLOAD_DIR, IMAGE_TYPES),
  fileFilter: filterFor(IMAGE_TYPES, "Profile picture must be a JPG, PNG, GIF or WebP image."),
  limits: {
    fileSize: MAX_AVATAR_FILE_MB * 1024 * 1024,
    files: 1,
  },
});

// Admin event posters (one image per request).
export const listingPosterUpload = multer({
  storage: storageFor(LISTING_UPLOAD_DIR, POSTER_TYPES),
  fileFilter: filterFor(POSTER_TYPES, "Poster must be a JPG, PNG or WebP image."),
  limits: {
    fileSize: MAX_POSTER_FILE_MB * 1024 * 1024,
    files: 1,
  },
});

export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const isPoster = req.baseUrl.endsWith("/admin");
    if (err.code === "LIMIT_FILE_SIZE") {
      const maxMb = req.baseUrl.endsWith("/user")
        ? MAX_AVATAR_FILE_MB
        : isPoster
          ? MAX_POSTER_FILE_MB
          : MAX_ISSUE_FILE_MB;
      return res.status(400).json({ success: false, message: `File too large (max ${maxMb}MB per file)` });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ success: false, message: `Too many files (max ${isPoster ? 1 : 3})` });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};
