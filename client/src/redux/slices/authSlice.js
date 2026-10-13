import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";
import { validateMajuEmail } from "../../utils/validation";
import { clearGuestSession } from "./guestSlice";

const GENERIC_EMAIL_REGEX = /^[\w.+-]+@([\w-]+\.)+[\w-]{2,}$/;

// Rate-limit and validation responses carry a specific, user-facing message
// (e.g. "try again in 15 minutes") that beats any generic fallback.
const serverMessage = (error) => error.response?.data?.message;

// Forgot/reset works for every account (students, staff, admins), so any
// well-formed email is accepted; the server's reply never reveals whether
// the account exists.
const validateResetEmail = (email) => {
  const normalized = (email || "").trim().toLowerCase();
  if (GENERIC_EMAIL_REGEX.test(normalized)) return { isValid: true, email: normalized };
  return { isValid: false, error: "Invalid email format" };
};

export const EMAIL_NOT_CONFIGURED_MESSAGE =
  "Email service is not configured yet. Please contact the university administrator.";

// 503 from register / resend / forgot-password: the university email
// (SMTP) hasn't been set up, so no OTP can be sent. Pages show this as a
// notice rather than a generic failure.
const emailNotConfigured = (error) =>
  error.response?.status === 503
    ? {
        success: false,
        emailNotConfigured: true,
        message: serverMessage(error) || EMAIL_NOT_CONFIGURED_MESSAGE,
      }
    : null;

export const registerUser = createAsyncThunk(
  "auth/register",
  async ({ name, email, password }) => {
    try {
      const nameRegex = /^[A-Za-z\s]+$/;
      if (!nameRegex.test(name)) {
        return {
          success: false,
          message: "Name should contain only alphabets and spaces",
        };
      }
      if (!name || name.length < 2) {
        return { success: false, message: "Name must be at least 2 characters" };
      }

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: emailValidation.error };
      }

      if (!password || password.length < 6) {
        return {
          success: false,
          message: "Password must be at least 6 characters",
        };
      }

      const { data } = await axios.post("/api/user/register", {
        name,
        email: emailValidation.email,
        password,
      });

      if (data.success) {
        return { success: true, email: emailValidation.email };
      }
      return { success: false, message: data.message };
    } catch (error) {
      const notConfigured = emailNotConfigured(error);
      if (notConfigured) return notConfigured;
      let message = serverMessage(error) || "Registration failed";
      if (error.response?.status === 400) {
        message = serverMessage(error) || "Invalid data";
      } else if (error.response?.status === 409) {
        message = "User already exists";
      } else if (error.response?.status === 429) {
        // retryAfter in the body (not just the header) means an OTP for this
        // email is still live, so the user can go straight to entering it.
        const otpPending = error.response?.data?.retryAfter !== undefined;
        return {
          success: false,
          message: serverMessage(error) || "Too many attempts. Please try again later.",
          otpPending,
          email: email?.trim().toLowerCase(),
        };
      } else if (error.code === "ERR_NETWORK") {
        message = "Network error";
      }
      return { success: false, message };
    }
  }
);

export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async ({ email, otp }) => {
    try {
      if (!email || !otp) {
        return { success: false, message: "Email and OTP are required" };
      }

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid email format" };
      }

      const cleanOtp = otp.toString().replace(/\s/g, "");
      if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
        return { success: false, message: "OTP must be 6 digits" };
      }

      const { data } = await axios.post("/api/user/verify-otp", {
        email: emailValidation.email,
        otp: cleanOtp,
      });

      if (data.success) {
        localStorage.setItem("token", data.token);
        return { success: true, token: data.token, user: data.user };
      }
      return {
        success: false,
        message: data.message,
        attemptsRemaining: data.attemptsRemaining,
        requiresNewOtp: data.requiresNewOtp,
      };
    } catch (error) {
      let message = serverMessage(error) || "Verification failed";
      if (error.response?.status === 400) {
        message = serverMessage(error) || "Invalid OTP";
      } else if (error.response?.status === 404) {
        message = "User not found";
      } else if (error.response?.status === 429) {
        message = serverMessage(error) || "Too many attempts. Please try again later.";
      } else if (error.code === "ERR_NETWORK") {
        message = "Network error";
      }
      return {
        success: false,
        message,
        attemptsRemaining: error.response?.data?.attemptsRemaining,
        requiresNewOtp: error.response?.data?.requiresNewOtp,
      };
    }
  }
);

export const resendOtp = createAsyncThunk(
  "auth/resendOtp",
  async ({ email }) => {
    try {
      if (!email) return { success: false, message: "Email is required" };

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid email format" };
      }

      const { data } = await axios.post("/api/user/resend-otp", {
        email: emailValidation.email,
      });

      if (data.success) return { success: true };
      return {
        success: false,
        message: data.message,
        retryAfter: data.retryAfter,
      };
    } catch (error) {
      const notConfigured = emailNotConfigured(error);
      if (notConfigured) return notConfigured;
      let message = serverMessage(error) || "Failed to resend OTP";
      if (error.response?.status === 404) message = "User not found";
      else if (error.response?.status === 429) {
        message = serverMessage(error) || "Too many attempts. Please try again later.";
      } else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message, retryAfter: error.response?.data?.retryAfter };
    }
  }
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { dispatch }) => {
    try {
      if (!email || !password) {
        return { success: false, message: "Email and password required" };
      }

      const normalized = email.trim().toLowerCase();
      if (!GENERIC_EMAIL_REGEX.test(normalized)) {
        return { success: false, message: "Invalid email format" };
      }

      const { data } = await axios.post("/api/user/login", {
        email: normalized,
        password,
      });

      if (data.success) {
        localStorage.setItem("token", data.token);
        dispatch(clearGuestSession());
        return { success: true, token: data.token, user: data.user };
      }
      return {
        success: false,
        message: data.message,
        attemptsRemaining: data.attemptsRemaining,
        needsVerification: data.needsVerification,
        email: normalized,
      };
    } catch (error) {
      const status = error.response?.status;
      const body = error.response?.data || {};
      let message = body.message || "Login failed";
      if (status === 400) message = body.message || "Invalid input";
      else if (status === 401) {
        message = "Invalid email or password";
        if (typeof body.attemptsRemaining === "number") {
          message += ` (${body.attemptsRemaining} attempt${
            body.attemptsRemaining === 1 ? "" : "s"
          } remaining)`;
        }
        return { success: false, message, attemptsRemaining: body.attemptsRemaining };
      } else if (status === 403) {
        if (body.needsVerification) {
          return {
            success: false,
            message: body.message || "Please verify your email first",
            needsVerification: true,
            email: body.email || email.trim().toLowerCase(),
          };
        }
        return {
          success: false,
          message: body.message || "Your account has been blocked.",
          blocked: !!body.blocked,
        };
      } else if (status === 429) {
        message = body.message || "Too many login attempts. Please try again later.";
      } else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
    }
  }
);

export const forgotPassword = createAsyncThunk(
  "auth/forgotPassword",
  async ({ email }) => {
    try {
      if (!email) return { success: false, message: "Email is required" };

      const emailValidation = validateResetEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: emailValidation.error };
      }

      const { data } = await axios.post("/api/user/forgot-password", {
        email: emailValidation.email,
      });

      if (data.success) {
        return { success: true, email: emailValidation.email };
      }
      return { success: false, message: data.message };
    } catch (error) {
      const notConfigured = emailNotConfigured(error);
      if (notConfigured) return notConfigured;
      let message = serverMessage(error) || "Failed to send reset OTP";
      if (error.response?.status === 429) {
        message = serverMessage(error) || "Too many attempts. Please try again later.";
      } else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
    }
  }
);

export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async ({ email, otp, newPassword }) => {
    try {
      if (!email || !otp || !newPassword) {
        return { success: false, message: "All fields are required" };
      }

      const emailValidation = validateResetEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: emailValidation.error };
      }

      if (newPassword.length < 6) {
        return {
          success: false,
          message: "Password must be at least 6 characters",
        };
      }

      const cleanOtp = otp.toString().replace(/\s/g, "");
      if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
        return { success: false, message: "OTP must be 6 digits" };
      }

      const { data } = await axios.post("/api/user/reset-password", {
        email: emailValidation.email,
        otp: cleanOtp,
        newPassword,
      });

      if (data.success) return { success: true };
      return {
        success: false,
        message: data.message,
        attemptsRemaining: data.attemptsRemaining,
      };
    } catch (error) {
      const body = error.response?.data || {};
      let message = body.message || "Failed to reset password";
      if (error.response?.status === 400) {
        message = body.message || "Invalid input";
        if (typeof body.attemptsRemaining === "number") {
          message += ` (${body.attemptsRemaining} attempt${
            body.attemptsRemaining === 1 ? "" : "s"
          } remaining)`;
        }
      } else if (error.response?.status === 404) message = "User not found";
      else if (error.response?.status === 429) {
        message = body.message || "Too many attempts. Please try again later.";
      } else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message, attemptsRemaining: body.attemptsRemaining };
    }
  }
);

export const fetchUser = createAsyncThunk(
  "auth/fetchUser",
  async (_, { getState }) => {
    const token = getState().auth.token;
    if (!token) return { success: false, unauthorized: true };

    try {
      const { data } = await axios.get("/api/user/get", {
        headers: { Authorization: token },
      });
      if (data.success) return { success: true, user: data.user };
      const unauthorized =
        data.message?.includes("Not authorized") ||
        data.message?.includes("Invalid token");
      if (unauthorized) localStorage.removeItem("token");
      return { success: false, unauthorized, message: data.message };
    } catch (error) {
      const status = error.response?.status;
      const unauthorized =
        status === 401 || (status === 403 && !!error.response?.data?.blocked);
      if (unauthorized) localStorage.removeItem("token");
      return { success: false, unauthorized };
    }
  }
);

// The root reducer (redux/store.js) resets every slice except theme when
// this fulfils, so no per-slice cleanup is needed here.
export const logoutUser = createAsyncThunk(
  "auth/logout",
  async (_, { dispatch }) => {
    localStorage.removeItem("token");
    dispatch(clearGuestSession());
    return true;
  }
);

// PATCH /api/user/profile — multipart (name + optional avatar file)
export const updateProfile = createAsyncThunk(
  "auth/updateProfile",
  async ({ name, avatarFile }, { getState }) => {
    const token = getState().auth.token;
    try {
      const fd = new FormData();
      if (name !== undefined) fd.append("name", name);
      if (avatarFile) fd.append("avatar", avatarFile);
      const { data } = await axios.patch("/api/user/profile", fd, {
        headers: {
          Authorization: token,
          "Content-Type": "multipart/form-data",
        },
      });
      return data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to update profile",
      };
    }
  }
);

// POST /api/user/change-password — { currentPassword, newPassword }
export const changePassword = createAsyncThunk(
  "auth/changePassword",
  async ({ currentPassword, newPassword }, { getState }) => {
    const token = getState().auth.token;
    try {
      const { data } = await axios.post(
        "/api/user/change-password",
        { currentPassword, newPassword },
        { headers: { Authorization: token } }
      );
      // The server invalidates tokens issued before a password change and
      // hands back a fresh one — persist it or the next request logs us out.
      if (data.success && data.token) localStorage.setItem("token", data.token);
      return data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to change password",
      };
    }
  }
);

// Lazy so a reset (see store.js) re-reads storage instead of reusing the
// token captured at module load.
const initialState = () => ({
  user: null,
  token: localStorage.getItem("token") || null,
  loadingUser: !!localStorage.getItem("token"),
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setLoadingUser(state, action) {
      state.loadingUser = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(verifyOtp.fulfilled, (state, action) => {
        if (action.payload.success) {
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.loadingUser = false;
        }
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        if (action.payload.success) {
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.loadingUser = false;
        }
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        if (action.payload.success) {
          state.user = action.payload.user;
        } else if (action.payload.unauthorized) {
          state.token = null;
          state.user = null;
        }
        state.loadingUser = false;
      })
      .addCase(fetchUser.rejected, (state) => {
        state.loadingUser = false;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.token = null;
        state.user = null;
        state.loadingUser = false;
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        if (action.payload.success && action.payload.token) {
          state.token = action.payload.token;
        }
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        if (action.payload.success) {
          state.user = action.payload.user;
        }
      });
  },
});

export const { setLoadingUser } = authSlice.actions;
export default authSlice.reducer;
