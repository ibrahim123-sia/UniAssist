import toast from "react-hot-toast";
import axios from "./axios";
import pythonAxios from "./pythonAxios";
import { logoutUser } from "../redux/slices/authSlice";

// Endpoints whose 401/403 is an expected answer for the form that called
// them (wrong password, unverified account, bad OTP), not an expired session.
const AUTH_FORM_ENDPOINTS = [
  "/api/user/login",
  "/api/user/register",
  "/api/user/verify-otp",
  "/api/user/resend-otp",
  "/api/user/forgot-password",
  "/api/user/reset-password",
  "/api/user/change-password",
];

const requestToken = (config) =>
  config?.headers?.get?.("Authorization") ?? config?.headers?.Authorization;

// Wired up from main.jsx (rather than importing the store here) so the
// axios modules stay free of a store -> slice -> axios import cycle.
export const setupInterceptors = (store) => {
  const onError = (error) => {
    const { response, config } = error;
    const status = response?.status;
    const blocked = status === 403 && response?.data?.blocked;
    const token = requestToken(config);
    const url = config?.url || "";

    if (
      (status === 401 || blocked) &&
      token &&
      // A stale response for a token we've since replaced (re-login,
      // password change) must not log out the new session.
      token === store.getState().auth.token &&
      !AUTH_FORM_ENDPOINTS.some((path) => url.includes(path))
    ) {
      toast.error(
        blocked
          ? response.data.message || "Your account has been blocked."
          : "Your session has expired. Please log in again.",
        { id: "session-ended" }
      );
      // Clearing the token makes ProtectedRoute redirect to /login (keeping
      // the current page as `from`); public pages, /login included, are
      // left alone, so this can't loop.
      store.dispatch(logoutUser());
    }
    return Promise.reject(error);
  };

  // The AI service checks the same JWT, but a 401 from it doesn't prove the
  // session is over — the two services may simply disagree on JWT_SECRET.
  // Ask Node first: if Node still accepts the token, keep the user logged in
  // and say what's wrong; if Node rejects it too, the axios interceptor
  // above logs out as usual.
  let confirming = null;
  const onPythonError = (error) => {
    const { response, config } = error;
    const token = requestToken(config);
    if (response?.status !== 401 || !token || token !== store.getState().auth.token) {
      return onError(error);
    }
    if (!confirming) {
      confirming = axios
        .get("/api/user/get", { headers: { Authorization: token } })
        .then(({ data }) => {
          if (data?.success && token === store.getState().auth.token) {
            toast.error(
              "AI service rejected the request — check that JWT_SECRET matches in server/.env and python/.env",
              { id: "python-auth", duration: 8000 }
            );
          }
        })
        .catch(() => {
          // Node's own 401 already triggered the logout above.
        })
        .finally(() => {
          confirming = null;
        });
    }
    return Promise.reject(error);
  };

  axios.interceptors.response.use((response) => response, onError);
  pythonAxios.interceptors.response.use((response) => response, onPythonError);
};
