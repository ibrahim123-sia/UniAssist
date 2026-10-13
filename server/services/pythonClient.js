// Calls into the Python FastAPI service (RAG answers + local Whisper STT).
// Uses Node's built-in fetch / FormData / Blob; `timeout:` is not a fetch
// option, so every call gets an AbortSignal deadline instead — otherwise a hung
// Python process would hold the HTTP request open forever.

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

const ASK_TIMEOUT_MS = 120 * 1000;        // local LLM on CPU can be slow
const TRANSCRIBE_TIMEOUT_MS = 120 * 1000; // Whisper on CPU, long clips
const EXTRACT_TIMEOUT_MS = 60 * 1000;     // page fetch + LLM extraction
const EXTRACT_JOB_TIMEOUT_MS = 15 * 1000; // start / poll a background extraction job
const KB_QA_TIMEOUT_MS = 30 * 1000;       // one embedding + Chroma write
const CLUSTER_TIMEOUT_MS = 30 * 1000;     // embed up to 1000 short questions
const HEALTH_TIMEOUT_MS = 5 * 1000;
const HEALTH_DETAILS_TIMEOUT_MS = 15 * 1000; // provider pings run concurrently, 5 s each

export const MAX_PROMPT_CHARS = 4000;
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MIN_AUDIO_BYTES = 1024;

// How many prior messages to send to the LLM as conversational context.
// 6 = 3 full turns — enough to resolve short follow-ups ("and its fee?").
const HISTORY_TURN_LIMIT = 6;
const HISTORY_ITEM_CHARS = 2000;

const internalHeaders = () =>
  process.env.INTERNAL_SECRET ? { "X-Internal-Secret": process.env.INTERNAL_SECRET } : {};

// Trimmed role/content history from stored messages, oldest → newest.
export function buildHistoryPayload(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  return messages
    .slice(-HISTORY_TURN_LIMIT)
    .filter((m) => m && m.role && m.content)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, HISTORY_ITEM_CHARS) }));
}

// `userId` / `chatId` let Python flag abusive logged-in users. Guests must NOT
// pass a userId — their session id is client-controlled.
// Returns `{ answer, answered, flagged }`; throws when Python is down.
export async function askPython(question, { userId, chatId, history } = {}) {
  const response = await fetch(`${PYTHON_BACKEND_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...internalHeaders() },
    body: JSON.stringify({
      question,
      user_id: userId ? String(userId) : undefined,
      chat_id: chatId ? String(chatId) : undefined,
      history: Array.isArray(history) ? history : undefined,
    }),
    signal: AbortSignal.timeout(ASK_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Python backend responded with status: ${response.status}`);
  }
  const data = await response.json();
  return {
    answer: data.answer || "No response from Python backend",
    // Older Python builds don't send `answered` — treat that as answered.
    answered: data.answered === undefined ? true : Boolean(data.answered),
    flagged: Boolean(data.flagged),
  };
}

// Error carrying the HTTP status Node should answer with.
export class PythonServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// FastAPI errors are `{detail: str}` (or a validation array for 422).
async function readDetail(response) {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string" && data.detail.trim()) return data.detail.trim().slice(0, 500);
  } catch {
    // non-JSON body
  }
  return "";
}

// POST an internal JSON endpoint; network/timeout errors become 502/504.
async function postInternal(path, body, timeoutMs) {
  try {
    return await fetch(`${PYTHON_BACKEND_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalHeaders() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new PythonServiceError(504, "The AI service took too long to respond. Please try again.");
    }
    throw new PythonServiceError(502, "Could not reach the AI service. Please try again later.");
  }
}

// Scrape + structure a job/scholarship page. Returns Python's
// `{kind, sourceUrl, extractedBy, fields}`. Python's 400 (bad/unsafe URL,
// non-HTML) and 502 (page unreachable) pass through with their message.
export async function extractListing(url, kind) {
  const response = await postInternal("/listings/extract", { url, kind }, EXTRACT_TIMEOUT_MS);
  if (!response.ok) {
    const detail = await readDetail(response);
    if (response.status === 400) throw new PythonServiceError(400, detail || "Invalid or unsupported URL");
    if (response.status === 422) throw new PythonServiceError(400, "Invalid URL or kind");
    if (response.status === 502) throw new PythonServiceError(502, detail || "Could not fetch that page");
    throw new PythonServiceError(502, `Extraction service error (${response.status})`);
  }
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== "object" || typeof data.fields !== "object" || !data.fields) {
    throw new PythonServiceError(502, "Extraction service returned an invalid response");
  }
  return data;
}

// Background variant for the admin's progress UI: start the extraction and
// poll it. Same validation/messages as extractListing. → jobId (string)
export async function startExtractJob(url, kind) {
  const response = await postInternal("/listings/extract-jobs", { url, kind }, EXTRACT_JOB_TIMEOUT_MS);
  if (!response.ok) {
    const detail = await readDetail(response);
    if (response.status === 400) throw new PythonServiceError(400, detail || "Invalid or unsupported URL");
    if (response.status === 422) throw new PythonServiceError(400, "Invalid URL or kind");
    if (response.status === 404) {
      throw new PythonServiceError(503, "The AI service is out of date (no background extraction). Please update and restart it.");
    }
    if (response.status === 429) {
      // Python's job registry is full — nothing was started.
      throw new PythonServiceError(503, detail || "Too many listing extractions are running. Try again shortly.");
    }
    throw new PythonServiceError(503, detail || `Extraction service error (${response.status})`);
  }
  const data = await response.json().catch(() => null);
  if (!data || typeof data.jobId !== "string" || !data.jobId) {
    throw new PythonServiceError(502, "Extraction service returned an invalid response");
  }
  return data.jobId;
}

// → `{jobId, status, stage, startedAt, updatedAt, result, error}`; a job
// Python no longer knows (expired / service restarted) → PythonServiceError 404.
export async function getExtractJob(jobId) {
  let response;
  try {
    response = await fetch(`${PYTHON_BACKEND_URL}/listings/extract-jobs/${encodeURIComponent(jobId)}`, {
      headers: internalHeaders(),
      signal: AbortSignal.timeout(EXTRACT_JOB_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new PythonServiceError(504, "The AI service took too long to respond. Please try again.");
    }
    throw new PythonServiceError(502, "Could not reach the AI service. Please try again later.");
  }
  if (response.status === 404) throw new PythonServiceError(404, "Extraction job not found");
  if (!response.ok) throw new PythonServiceError(502, `Extraction service error (${response.status})`);
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== "object" || typeof data.status !== "string") {
    throw new PythonServiceError(502, "Extraction service returned an invalid response");
  }
  return data;
}

// Add one admin-written Q&A chunk to the chatbot knowledge base → `{id}`.
export async function addQaToKnowledgeBase({ question, answer, sourceLabel }) {
  const response = await postInternal(
    "/kb/qa",
    { question: String(question).slice(0, 1000), answer: String(answer).slice(0, 4000), sourceLabel },
    KB_QA_TIMEOUT_MS
  );
  if (!response.ok) {
    const detail = await readDetail(response);
    throw new PythonServiceError(502, detail || `Knowledge base service error (${response.status})`);
  }
  const data = await response.json().catch(() => null);
  if (!data?.success || !data.id) {
    throw new PythonServiceError(502, "Knowledge base service returned an invalid response");
  }
  return { id: String(data.id) };
}

// Remove an admin Q&A chunk (`qa_…`) — used when an answer is edited so the
// KB keeps exactly one chunk per answer. → true if it existed, false if not.
export async function deleteQaFromKnowledgeBase(chunkId) {
  let response;
  try {
    response = await fetch(`${PYTHON_BACKEND_URL}/kb/qa/${encodeURIComponent(chunkId)}`, {
      method: "DELETE",
      headers: internalHeaders(),
      signal: AbortSignal.timeout(KB_QA_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new PythonServiceError(504, "The AI service took too long to respond. Please try again.");
    }
    throw new PythonServiceError(502, "Could not reach the AI service. Please try again later.");
  }
  if (!response.ok) {
    const detail = await readDetail(response);
    throw new PythonServiceError(502, detail || `Knowledge base service error (${response.status})`);
  }
  const data = await response.json().catch(() => null);
  return Boolean(data?.deleted);
}

// Group near-duplicate questions by meaning (sentence embeddings, no LLM).
// items: [{id, text}] → [{ids: [..], representativeId}]. Throws on any failure
// — callers fall back to exact grouping.
export async function clusterQuestions(items, threshold) {
  const body = { items };
  if (typeof threshold === "number") body.threshold = threshold;
  const response = await postInternal("/questions/cluster", body, CLUSTER_TIMEOUT_MS);
  if (!response.ok) {
    const detail = await readDetail(response);
    throw new PythonServiceError(502, detail || `Similarity service error (${response.status})`);
  }
  const data = await response.json().catch(() => null);
  const clusters = data?.clusters;
  if (
    !Array.isArray(clusters) ||
    !clusters.every((c) => c && Array.isArray(c.ids) && c.ids.length > 0)
  ) {
    throw new PythonServiceError(502, "Similarity service returned an invalid response");
  }
  return clusters.map((c) => ({
    ids: c.ids.map(String),
    representativeId: c.representativeId != null ? String(c.representativeId) : String(c.ids[0]),
  }));
}

// Admin "System health": liveness (/health) and then the detailed provider /
// knowledge-base report (/health/details). Never throws.
// → { ok, latencyMs, error, details }
export async function pythonHealthReport() {
  const started = Date.now();
  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      return { ok: false, latencyMs, error: `AI service responded with status ${response.status}`, details: null };
    }
    let details = null;
    let error = null;
    try {
      const detailsResponse = await fetch(`${PYTHON_BACKEND_URL}/health/details`, {
        headers: internalHeaders(),
        signal: AbortSignal.timeout(HEALTH_DETAILS_TIMEOUT_MS),
      });
      if (detailsResponse.ok) details = await detailsResponse.json().catch(() => null);
      else error = `Health details unavailable (status ${detailsResponse.status})`;
    } catch (e) {
      error = e.name === "TimeoutError" ? "Health details timed out" : "Health details unavailable";
    }
    return { ok: true, latencyMs, error, details };
  } catch (e) {
    return {
      ok: false,
      latencyMs: null,
      error: e.name === "TimeoutError" ? "AI service did not respond in time" : "Could not reach the AI service",
      details: null,
    };
  }
}

const AUDIO_EXTENSIONS = { wav: "wav", "x-wav": "wav", mpeg: "mp3", mp3: "mp3", ogg: "ogg", mp4: "m4a", "x-m4a": "m4a", m4a: "m4a", webm: "webm" };

// Validate a `data:audio/...;base64,...` URL and decode it. Returns
// { buffer, extension } or { error } with a user-facing message.
export function decodeAudioDataUrl(audioUrl) {
  if (typeof audioUrl !== "string" || !audioUrl) {
    return { error: "Audio data is required" };
  }
  const match = audioUrl.match(/^data:audio\/([a-z0-9.+-]+)(?:;[^,]*)?;base64,/i);
  if (!match) {
    return { error: "Invalid audio format. Expected base64 audio data." };
  }
  const extension = AUDIO_EXTENSIONS[match[1].toLowerCase()] || "webm";
  const buffer = Buffer.from(audioUrl.slice(match[0].length), "base64");
  if (buffer.length < MIN_AUDIO_BYTES) {
    return { error: "Audio file is too small. Please speak longer (at least 2-3 seconds)." };
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    return { error: "Audio file is too large. Maximum size is 5MB." };
  }
  return { buffer, extension };
}

// Forward audio to Python /transcribe (local faster-whisper). Never throws:
// returns { success, text } or { success: false, error }.
export async function transcribeWithPython(buffer, extension) {
  try {
    const form = new FormData();
    form.append("file", new Blob([buffer]), `audio.${extension}`);

    const response = await fetch(`${PYTHON_BACKEND_URL}/transcribe`, {
      method: "POST",
      body: form,
      headers: internalHeaders(),
      signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { success: false, error: `Python /transcribe returned ${response.status}: ${detail.slice(0, 200)}` };
    }

    const data = await response.json();
    const text = (data.text || "").trim();
    if (!text) return { success: false, error: "Whisper returned empty transcription" };
    return { success: true, text, language: data.language, duration: data.duration };
  } catch (error) {
    console.error("Whisper transcription error:", error.message);
    return { success: false, error: `Transcription failed: ${error.message}` };
  }
}

// Cheap liveness probe — doesn't burn an LLM call.
export async function pythonIsHealthy() {
  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
