import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer, { logoutUser } from "./slices/authSlice";
import chatReducer from "./slices/chatSlice";
import guestReducer from "./slices/guestSlice";
import themeReducer from "./slices/themeSlice";
import issueReducer from "./slices/issueSlice";
import notificationReducer from "./slices/notificationSlice";
import departmentReducer from "./slices/departmentSlice";
import adminStatsReducer from "./slices/adminStatsSlice";
import adminUserReducer from "./slices/adminUserSlice";
import adminStaffReducer from "./slices/adminStaffSlice";
import adminQueryReducer from "./slices/adminQuerySlice";
import adminDataReducer from "./slices/adminDataSlice";
import adminLogReducer from "./slices/adminLogSlice";
import adminListingReducer from "./slices/adminListingSlice";
import adminQuestionReducer from "./slices/adminQuestionSlice";
import adminHealthReducer from "./slices/adminHealthSlice";
import listingReducer from "./slices/listingSlice";
import questionReducer from "./slices/questionSlice";
import adminSettingsReducer from "./slices/adminSettingsSlice";

const appReducer = combineReducers({
  auth: authReducer,
  chat: chatReducer,
  guest: guestReducer,
  theme: themeReducer,
  issue: issueReducer,
  notification: notificationReducer,
  department: departmentReducer,
  adminStats: adminStatsReducer,
  adminUser: adminUserReducer,
  adminStaff: adminStaffReducer,
  adminQuery: adminQueryReducer,
  adminData: adminDataReducer,
  adminLog: adminLogReducer,
  adminListing: adminListingReducer,
  adminQuestion: adminQuestionReducer,
  adminHealth: adminHealthReducer,
  adminSettings: adminSettingsReducer,
  listing: listingReducer,
  question: questionReducer,
});

// Logging out wipes every slice back to its initial state so nothing from
// the previous account (chats, issues, admin tables...) leaks into the next
// session. Theme is a device preference, so it survives.
const rootReducer = (state, action) => {
  if (action.type === logoutUser.fulfilled.type) {
    return appReducer({ theme: state?.theme }, action);
  }
  return appReducer(state, action);
};

// Requests that were in flight when the user logged out must not refill the
// freshly reset slices (e.g. a slow chat list or admin table arriving after
// logout, or after logging in as someone else). Every async thunk is tagged
// with the "session epoch" it started in; results from an older epoch are
// dropped before they reach the reducers. Callers awaiting the thunk still
// get their result — only the store ignores it.
const staleSessionGuard = () => {
  let epoch = 0;
  const startedIn = new Map();
  return (next) => (action) => {
    const requestId = action?.meta?.requestId;
    const status = action?.meta?.requestStatus;
    if (action?.type === logoutUser.fulfilled.type) {
      startedIn.delete(requestId);
      const result = next(action);
      epoch += 1;
      return result;
    }
    if (requestId && status === "pending") {
      startedIn.set(requestId, epoch);
    } else if (requestId && (status === "fulfilled" || status === "rejected")) {
      const started = startedIn.get(requestId);
      startedIn.delete(requestId);
      if (started !== undefined && started !== epoch) return action;
    }
    return next(action);
  };
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) => getDefault().concat(staleSessionGuard),
});
