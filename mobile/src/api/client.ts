import axios from "axios";

// Inlined at bundle time from .env (Expo only inlines EXPO_PUBLIC_* accessed
// with dot notation). Empty when unset — App.tsx shows a config screen then.
export const SERVER_URL: string = (process.env.EXPO_PUBLIC_SERVER_URL || "").replace(/\/+$/, "");

// Uploaded files are stored as server-relative paths (/uploads/...). Absolute
// http(s) URLs and on-device URIs (a freshly picked image: file:, content:,
// ph:, data:) are used as they are.
export const fileUrl = (path?: string | null): string | null => {
  if (!path) return null;
  if (/^(https?|file|content|ph|assets-library|data):/i.test(path)) return path;
  return `${SERVER_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

// Chat replies wait on the LLM and transcription on Whisper, both of which
// routinely exceed the default timeout.
export const SLOW_REQUEST_TIMEOUT = 90000;
// Multipart uploads (avatar, issue attachments) over a slow mobile link.
export const UPLOAD_TIMEOUT = 60000;

const client = axios.create({ baseURL: SERVER_URL, timeout: 15000 });

// The token lives in expo-secure-store; the auth slice pushes it here after
// login/restore so every request carries it without reading redux.
let currentToken: string | null = null;
export const setAuthToken = (t: string | null) => {
  currentToken = t;
};
// Read by the store's stale-result guard (redux/store.ts).
export const getAuthToken = () => currentToken;

client.interceptors.request.use((config) => {
  if (currentToken && config.headers) {
    (config.headers as any).Authorization = currentToken;
  }
  return config;
});

// A 401/403 from these is an answer for the form that called them (wrong
// password, unverified account, bad OTP), not an ended session.
const AUTH_FORM_ENDPOINTS = [
  "/api/user/login",
  "/api/user/register",
  "/api/user/verify-otp",
  "/api/user/resend-otp",
  "/api/user/forgot-password",
  "/api/user/reset-password",
  "/api/user/change-password",
];

type SessionEndedHandler = (message: string) => void;
let onSessionEnded: SessionEndedHandler | null = null;
// Registered from App.tsx so this module doesn't import the store (which
// imports the slices, which import this module).
export const setSessionEndedHandler = (h: SessionEndedHandler | null) => {
  onSessionEnded = h;
};

client.interceptors.response.use(
  (r) => r,
  (error) => {
    const { response, config } = error || {};
    const status = response?.status;
    const blocked = status === 403 && !!response?.data?.blocked;
    const sentToken = (config?.headers as any)?.Authorization;
    const url: string = config?.url || "";
    if (
      (status === 401 || blocked) &&
      sentToken &&
      // A late response for a token we've since replaced (re-login, password
      // change) must not end the new session.
      sentToken === currentToken &&
      !AUTH_FORM_ENDPOINTS.some((p) => url.includes(p))
    ) {
      onSessionEnded?.(
        blocked
          ? response.data.message || "Your account has been blocked."
          : "Your session has expired. Please log in again."
      );
    }
    return Promise.reject(error);
  }
);

// Server error message, falling back to a network/timeout explanation.
export const errorMessage = (e: any, fallback = "Something went wrong. Please try again."): string => {
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.code === "ECONNABORTED" || e?.code === "ETIMEDOUT") return "The request timed out. Please try again.";
  if (e?.message === "Network Error") return "Can't reach the server. Check your connection.";
  return fallback;
};

export default client;
