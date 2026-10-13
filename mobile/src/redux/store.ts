import { configureStore, combineReducers, type AnyAction, type Middleware } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  persistReducer,
  persistStore,
  createTransform,
  FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER,
} from "redux-persist";
import autoMergeLevel2 from "redux-persist/lib/stateReconciler/autoMergeLevel2";

import authReducer, { logout } from "./slices/authSlice";
import themeReducer from "./slices/themeSlice";
import issueReducer from "./slices/issueSlice";
import notificationReducer from "./slices/notificationSlice";
import chatReducer from "./slices/chatSlice";
import outboxReducer from "./slices/outboxSlice";
import { getAuthToken } from "../api/client";

const appReducer = combineReducers({
  auth: authReducer,
  theme: themeReducer,
  issue: issueReducer,
  notification: notificationReducer,
  chat: chatReducer,
  outbox: outboxReducer,
});

type AppState = ReturnType<typeof appReducer>;

// Logging out wipes everything a previous user could leave behind (chats,
// issues, notifications) except the theme preference and the offline issues
// a student queued — those stay tagged with their owner and are only sent
// (or shown) once that same student signs in again.
const rootReducer = (state: AppState | undefined, action: AnyAction): AppState => {
  if (action.type === logout.fulfilled.type && state) {
    const fresh = appReducer(undefined, { type: "@@reset" });
    return {
      ...fresh,
      theme: state.theme,
      outbox: { items: state.outbox.items.filter((i) => !!i.userId) },
      auth: { ...fresh.auth, bootstrapped: true },
    };
  }
  return appReducer(state, action);
};

// A request that was in flight when the user signed out (or the token
// changed) must not refill the freshly reset slices: async-thunk results are
// dropped unless the token is still the one that was live when the thunk
// started. auth/* thunks are exempt — they are what change the token.
const startedWith = new Map<string, string | null>();
const staleResultGuard: Middleware = () => (next) => (action: any) => {
  const status = action?.meta?.requestStatus;
  const id = action?.meta?.requestId;
  if (!status || !id || String(action.type).startsWith("auth/")) return next(action);
  if (status === "pending") {
    startedWith.set(id, getAuthToken());
    return next(action);
  }
  const token = startedWith.has(id) ? startedWith.get(id) : getAuthToken();
  startedWith.delete(id);
  if (token !== getAuthToken()) return action;
  return next(action);
};

// The JWT stays in expo-secure-store only; AsyncStorage is unencrypted, so
// only the cached profile is written for offline start-up.
const authTransform = createTransform(
  (inbound: any) => ({ user: inbound?.user ?? null }),
  (outbound: any) => ({ user: outbound?.user ?? null }),
  { whitelist: ["auth"] }
);

// Earlier builds persisted the JWT and per-user issue/notification lists
// under this key; drop it rather than rehydrate any of that.
AsyncStorage.removeItem("persist:uniassist").catch(() => {});

const persistConfig = {
  key: "uniassist-v2",
  storage: AsyncStorage,
  whitelist: ["auth", "theme", "outbox"],
  transforms: [authTransform],
  // Merge the cached auth.user into the slice instead of replacing the slice
  // (which would drop token/bootstrapped from the initial state).
  stateReconciler: autoMergeLevel2,
};

const persistedReducer = persistReducer<AppState>(persistConfig, rootReducer as any);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(staleResultGuard),
});

export const persistor = persistStore(store);
export type RootState = AppState;
export type AppDispatch = typeof store.dispatch;
