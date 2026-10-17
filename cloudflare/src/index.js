import { Container, getContainer } from "@cloudflare/containers";

// UniAssist backend on Cloudflare: one Worker in front of two containers.
//
//   /uploads/*  → R2 bucket (files the API server stored there)
//   /ai/*       → AiService container (python/, FastAPI) with /ai stripped
//   everything  → ApiServer container (server/, Express)
//
// The containers sleep when idle; the Cron Trigger below runs the API
// server's background jobs (SLA escalation) on schedule.

// Worker vars/secrets → container env. Unset or empty values are left out so
// the apps fall back to their own defaults.
const pick = (env, names) =>
  Object.fromEntries(
    names.filter((n) => env[n] !== undefined && env[n] !== "").map((n) => [n, String(env[n])])
  );

const SHARED = [
  "JWT_SECRET",
  "INTERNAL_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
];

const trimSlash = (url) => String(url || "").replace(/\/+$/, "");

export class ApiServer extends Container {
  defaultPort = 3000;
  // Short, because the hourly cron wakes it: ~10 min awake per hour instead
  // of never sleeping. Memory is billed for every minute it is awake.
  sleepAfter = "10m";

  constructor(ctx, env) {
    super(ctx, env);
    // Read when the container starts: changed secrets apply on its next start.
    this.envVars = {
      ...pick(env, [
        ...SHARED,
        "MONGODB_URI",
        "CLIENT_URL",
        "APP_URL",
        "EMAIL_USER",
        "EMAIL_PASS",
        "SETTINGS_SECRET",
        "ISSUE_SLA_HOURS",
      ]),
      NODE_ENV: "production",
      PORT: "3000",
      // The Worker sets X-Forwarded-For to the visitor's IP (see below).
      TRUST_PROXY: "1",
      // The timers stop while the container sleeps; the Cron Trigger runs them.
      DISABLE_SCHEDULERS: "true",
      PYTHON_BACKEND_URL: `${trimSlash(env.PUBLIC_URL)}/ai`,
    };
  }
}

export class AiService extends Container {
  defaultPort = 8000;
  sleepAfter = "30m";
  pingEndpoint = "health";

  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = {
      ...pick(env, [
        ...SHARED,
        "GROQ_API_KEY",
        "GROQ_API_KEY_2",
        "GROQ_API_KEY_3",
        "GROQ_MODEL",
        "GEMINI_API_KEY",
        "GEMINI_MODEL",
        "CLOUD_LLM_ORDER",
        "WHISPER_MODEL",
      ]),
      USE_LOCAL_LLM: "false",
      NODE_INTERNAL_URL: trimSlash(env.PUBLIC_URL),
      CORS_ALLOW_ORIGINS: env.CLIENT_URL || "",
    };
  }
}

// The visitor's IP for the server's rate limits. Overwritten, not appended,
// so a client can't spoof it.
function withClientIp(request) {
  const headers = new Headers(request.headers);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) headers.set("X-Forwarded-For", ip);
  else headers.delete("X-Forwarded-For");
  return headers;
}

async function serveUpload(request, env, url) {
  const key = decodeURIComponent(url.pathname.slice(1)); // "uploads/issues/<file>"
  if (key.includes("..")) return null;
  const object = request.method === "HEAD" ? await env.UPLOADS.head(key) : await env.UPLOADS.get(key);
  if (!object) return null;
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/uploads/")) {
      const file = await serveUpload(request, env, url);
      if (file) return file;
      // Not in R2: let the API server answer (404, or a file on its disk).
    }

    if (url.pathname === "/ai" || url.pathname.startsWith("/ai/")) {
      url.pathname = url.pathname.slice(3) || "/";
      const forwarded = new Request(url, new Request(request, { headers: withClientIp(request) }));
      return getContainer(env.AI_SERVICE).fetch(forwarded);
    }

    return getContainer(env.API_SERVER).fetch(new Request(request, { headers: withClientIp(request) }));
  },

  // Cron Trigger: background jobs that used to run on in-process timers.
  async scheduled(event, env, ctx) {
    const run = getContainer(env.API_SERVER)
      .fetch(
        new Request("http://api-server/api/admin/internal/run-jobs", {
          method: "POST",
          headers: { "x-internal-secret": env.INTERNAL_SECRET },
        })
      )
      .then(async (res) => console.log(`run-jobs: ${res.status} ${await res.text()}`));
    ctx.waitUntil(run);
  },
};
