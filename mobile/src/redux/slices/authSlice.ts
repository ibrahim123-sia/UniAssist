import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import * as SecureStore from "expo-secure-store";
import { apiLogin, apiGetUser } from "../../api/auth";
import { setAuthToken, errorMessage } from "../../api/client";

const TOKEN_KEY = "uniassist_token";

// The mobile app is for students only; staff and admins use the web portal.
export const STUDENTS_ONLY_MESSAGE =
  "UniAssist mobile is for students. Staff and administrators, please use the web portal.";
const isStudent = (user: any) => user?.role === "student";

export interface User {
  _id: string;
  name: string;
  email: string;
  role: "student";
  program?: string | null;
  rollNumber?: string | null;
  session?: string | null;
  admissionYear?: number | null;
  profilePicture?: string;
  isBlocked?: boolean;
}

interface AuthState {
  // Mirrors the token in expo-secure-store; never persisted to AsyncStorage
  // (see the transform in store.ts).
  token: string | null;
  user: User | null;
  // False until restoreSession has run, so the navigator doesn't flash the
  // login screen for a user who is actually signed in.
  bootstrapped: boolean;
  loading: boolean;
  // Set when a stored session turned out to belong to a non-student account;
  // the login screen shows it once.
  notice: string | null;
}

const initialState: AuthState = {
  token: null,
  user: null,
  bootstrapped: false,
  loading: false,
  notice: null,
};

export interface LoginFailure {
  message: string;
  needsVerification?: boolean;
  email?: string;
  blocked?: boolean;
  notStudent?: boolean;
}

// Stores the token and makes it live for every request. Used by login, OTP
// verification and password change (which issues a new token). Rejects a
// non-student account without storing anything.
export const startSession = createAsyncThunk<
  { token: string; user: User | null },
  { token: string; user?: any },
  { rejectValue: string }
>("auth/startSession", async ({ token, user }, { rejectWithValue }) => {
  if (user && !isStudent(user)) return rejectWithValue(STUDENTS_ONLY_MESSAGE);
  // Swap the in-memory token first: after a password change the old one is
  // already rejected, and a 401 for it must not count as the live session.
  setAuthToken(token);
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  return { token, user: (user as User) ?? null };
});

export const login = createAsyncThunk<
  void,
  { email: string; password: string },
  { rejectValue: LoginFailure }
>("auth/login", async (creds, { dispatch, rejectWithValue }) => {
  const email = creds.email.trim().toLowerCase();
  try {
    const { data } = await apiLogin(email, creds.password);
    if (!data?.success || !data.token) {
      return rejectWithValue({ message: data?.message || "Login failed" });
    }
    // Checked before the token is stored, so a staff/admin login never
    // starts a session on this device.
    if (!isStudent(data.user)) {
      return rejectWithValue({ message: STUDENTS_ONLY_MESSAGE, notStudent: true });
    }
    const r = await dispatch(startSession({ token: data.token, user: data.user }));
    if (startSession.rejected.match(r)) {
      return rejectWithValue({ message: r.payload || STUDENTS_ONLY_MESSAGE, notStudent: true });
    }
  } catch (e: any) {
    const status = e?.response?.status;
    const body = e?.response?.data || {};
    if (status === 401) {
      const left = body.attemptsRemaining;
      return rejectWithValue({
        message:
          "Invalid email or password" +
          (typeof left === "number" ? ` (${left} attempt${left === 1 ? "" : "s"} remaining)` : ""),
      });
    }
    if (status === 403 && body.needsVerification) {
      return rejectWithValue({
        message: body.message,
        needsVerification: true,
        email: body.email || email,
      });
    }
    if (status === 403 && body.blocked) {
      return rejectWithValue({ message: body.message, blocked: true });
    }
    return rejectWithValue({ message: errorMessage(e, "Login failed") });
  }
});

const clearStoredToken = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  setAuthToken(null);
};

export const restoreSession = createAsyncThunk(
  "auth/restore",
  async (_, { getState }): Promise<{ token: string; user: User } | { notice: string } | null> => {
    const t = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!t) return null;
    setAuthToken(t);
    try {
      const { data } = await apiGetUser();
      if (data?.success) {
        if (isStudent(data.user)) return { token: t, user: data.user as User };
        // A staff/admin token (e.g. stored by an older build): drop it.
        await clearStoredToken();
        return { notice: STUDENTS_ONLY_MESSAGE };
      }
    } catch (e: any) {
      if (!e?.response) {
        // Offline / server unreachable: keep the session on the cached user so
        // the app still opens (the next protected call re-validates the
        // token). Without a cached student user, keep the token for the next
        // launch.
        const cached = (getState() as { auth: AuthState }).auth.user;
        if (cached && isStudent(cached)) return { token: t, user: cached };
        setAuthToken(null);
        return null;
      }
    }
    // Rejected (expired, password changed, blocked, deleted user).
    await clearStoredToken();
    return null;
  }
);

export const logout = createAsyncThunk("auth/logout", async () => {
  await clearStoredToken();
  return true;
});

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
    },
    clearNotice(state) {
      state.notice = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(login.pending, (s) => { s.loading = true; })
     .addCase(login.fulfilled, (s) => { s.loading = false; })
     .addCase(login.rejected, (s) => { s.loading = false; })
     .addCase(startSession.fulfilled, (s, a) => {
       s.token = a.payload.token;
       if (a.payload.user) s.user = a.payload.user;
     })
     .addCase(restoreSession.fulfilled, (s, a) => {
       s.bootstrapped = true;
       if (a.payload && "token" in a.payload) {
         s.token = a.payload.token;
         s.user = a.payload.user;
       } else {
         s.token = null;
         s.user = null;
         if (a.payload && "notice" in a.payload) s.notice = a.payload.notice;
       }
     })
     .addCase(restoreSession.rejected, (s) => {
       s.bootstrapped = true;
       s.token = null;
       s.user = null;
     });
    // logout.fulfilled resets every slice in store.ts's root reducer.
  },
});

export const { setUser, clearNotice } = slice.actions;
export default slice.reducer;
