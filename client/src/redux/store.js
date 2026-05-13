import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import chatReducer from "./slices/chatSlice";
import guestReducer from "./slices/guestSlice";
import themeReducer from "./slices/themeSlice";
import issueReducer from "./slices/issueSlice";
import notificationReducer from "./slices/notificationSlice";
import departmentReducer from "./slices/departmentSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    guest: guestReducer,
    theme: themeReducer,
    issue: issueReducer,
    notification: notificationReducer,
    department: departmentReducer,
  },
});
