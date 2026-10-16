import fs from "fs";
import path from "path";
import { AwsClient } from "aws4fetch";

// Uploaded files live on local disk (uploads/...). When R2 is configured they
// are also copied to the bucket under the same key ("uploads/issues/<file>"),
// because a Cloudflare container's disk is wiped whenever it sleeps or is
// redeployed. The Cloudflare Worker serves /uploads/* straight from the
// bucket; the fallback below covers anything else that reaches this server.
//
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
// (R2_ENDPOINT instead of R2_ACCOUNT_ID for another S3-compatible store).
// Without them everything stays local-only (development).

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
const R2_ENDPOINT = (
  process.env.R2_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "")
).replace(/\/+$/, "");

export const remoteStorageEnabled = Boolean(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);

const r2 = remoteStorageEnabled
  ? new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    })
  : null;

const objectUrl = (key) => `${R2_ENDPOINT}/${R2_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;

// "uploads/issues/x.pdf", "/uploads/issues/x.pdf" or an absolute path under
// the working directory → "uploads/issues/x.pdf". Anything outside uploads/
// → null, so a bad value can never touch other keys.
export const uploadKey = (fileOrUrl) => {
  if (!fileOrUrl) return null;
  let rel = String(fileOrUrl).replace(/\\/g, "/");
  // A stored URL ("/uploads/...") looks absolute to path.isAbsolute too.
  if (rel.startsWith("/uploads/")) rel = rel.slice(1);
  else if (path.isAbsolute(rel)) rel = path.relative(process.cwd(), rel).replace(/\\/g, "/");
  const normalized = path.posix.normalize(rel);
  return normalized.startsWith("uploads/") && !normalized.includes("..") ? normalized : null;
};

// Copy a file multer just wrote to the bucket. Resolves immediately when R2
// isn't configured.
export async function putUpload(filePath, contentType) {
  if (!r2) return;
  const key = uploadKey(filePath);
  if (!key) throw new Error("Upload path outside uploads/");
  const body = await fs.promises.readFile(filePath);
  const res = await r2.fetch(objectUrl(key), {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType || "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`Storing the file failed (R2 ${res.status})`);
}

// Best-effort delete of an upload, locally and in the bucket. Never throws.
export function deleteUpload(fileOrUrl) {
  const key = uploadKey(fileOrUrl);
  if (!key) return;
  fs.unlink(path.join(process.cwd(), key), () => {});
  if (r2) {
    r2.fetch(objectUrl(key), { method: "DELETE" })
      .then((res) => {
        if (!res.ok && res.status !== 404) console.error(`R2 delete failed for ${key}: ${res.status}`);
      })
      .catch((error) => console.error(`R2 delete failed for ${key}:`, error.message));
  }
}

// Express handler after express.static: a file missing on this (fresh) disk
// is streamed from the bucket instead of a 404.
export async function serveUploadFromRemote(req, res, next) {
  if (!r2 || (req.method !== "GET" && req.method !== "HEAD")) return next();
  const key = uploadKey(`uploads${req.path}`);
  if (!key) return next();
  try {
    const remote = await r2.fetch(objectUrl(key), { method: req.method });
    if (!remote.ok) return next();
    res.set("Content-Type", remote.headers.get("content-type") || "application/octet-stream");
    const length = remote.headers.get("content-length");
    if (length) res.set("Content-Length", length);
    res.set("Cache-Control", "public, max-age=86400");
    if (req.method === "HEAD") return res.end();
    res.end(Buffer.from(await remote.arrayBuffer()));
  } catch (error) {
    console.error(`R2 read failed for ${key}:`, error.message);
    next();
  }
}
