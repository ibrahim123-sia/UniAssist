import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";
import { validateMajuEmail } from "../../utils/validation";
import { resetChat } from "./chatSlice";
import { clearGuestSession } from "./guestSlice";

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
      let message = "Registration failed";
      if (error.response?.status === 400) {
        message = error.response?.data?.message || "Invalid data";
      } else if (error.response?.status === 409) {
        message = "User already exists";
      } else if (error.response?.status === 429) {
        message = "Too many attempts";
      } else if (error.code === "ERR_NETWORK") {
        message = "Network error";
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
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
      let message = "Verification failed";
      if (error.response?.status === 400) {
        message = error.response?.data?.message || "Invalid OTP";
      } else if (error.response?.status === 404) {
        message = "User not found";
      } else if (error.response?.status === 429) {
        message = "Too many attempts";
      } else if (error.code === "ERR_NETWORK") {
        message = "Network error";
      }
      return { success: false, message };
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
      let message = "Failed to resend OTP";
      if (error.response?.status === 400) message = "Invalid email";
      else if (error.response?.status === 404) message = "User not found";
      else if (error.response?.status === 429) message = "Too many attempts";
      else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
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

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid email format" };
      }

      const { data } = await axios.post("/api/user/login", {
        email: emailValidation.email,
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
        email: emailValidation.email,
      };
    } catch (error) {
      let message = "Login failed";
      if (error.response?.status === 400) message = "Invalid input";
      else if (error.response?.status === 401)
        message = "Invalid email or password";
      else if (error.response?.status === 403) {
        return {
          success: false,
          message: "Please verify your email first",
          needsVerification: true,
          email,
        };
      } else if (error.response?.status === 429) message = "Account locked";
      else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
    }
  }
);

export const forgotPassword = createAsyncThunk(
  "auth/forgotPassword",
  async ({ email }) => {
    try {
      if (!email) return { success: false, message: "Email is required" };

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid email format" };
      }

      const { data } = await axios.post("/api/user/forgot-password", {
        email: emailValidation.email,
      });

      if (data.success) {
        return { success: true, email: emailValidation.email };
      }
      return { success: false, message: data.message };
    } catch (error) {
      let message = "Failed to send reset OTP";
      if (error.response?.status === 400) message = "Invalid email";
      else if (error.response?.status === 429) message = "Too many attempts";
      else if (error.code === "ERR_NETWORK") message = "Network error";
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

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid email format" };
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
      let message = "Failed to reset password";
      if (error.response?.status === 400) message = "Invalid input";
      else if (error.response?.status === 404) message = "User not found";
      else if (error.response?.status === 429) message = "Too many attempts";
      else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
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
      return { success: false, unauthorized, message: data.message };
    } catch (error) {
      const unauthorized = error.response?.status === 401;
      return { success: false, unauthorized };
    }
  }
);

export const logoutUser = createAsyncThunk(
  "auth/logout",
  async (_, { dispatch }) => {
    localStorage.removeItem("token");
    dispatch(resetChat());
    dispatch(clearGuestSession());
    return true;
  }
);

const initialState = {
  user: null,
  token: localStorage.getItem("token") || null,
  loadingUser: true,
};

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
      });
  },
});

export const { setLoadingUser } = authSlice.actions;
export default authSlice.reducer;
