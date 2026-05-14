import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
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

export const store = configureStore({
  reducer: {
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
  },
});
