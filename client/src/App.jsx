import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import MainLayout from "./components/layouts/MainLayout";
import Login from "./auth/Login";
import Register from "./auth/Register";
import ProtectedRoute from "./auth/ProtectedRoute";
import ChatPage from "./student/pages/ChatPage";
import GuestChat from "./guest/GuestChat";
import Jobs from "./student/pages/Job";
import Events from "./student/pages/Events";
import { fetchUser, setLoadingUser } from "./redux/slices/authSlice";
import { fetchUsersChats } from "./redux/slices/chatSlice";
import { fetchGuestChatHistory } from "./redux/slices/guestSlice";

const App = () => {
  const dispatch = useDispatch();
  const theme = useSelector((s) => s.theme.theme);
  const token = useSelector((s) => s.auth.token);
  const user = useSelector((s) => s.auth.user);
  const guestSessionId = useSelector((s) => s.guest.guestSessionId);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (token) {
      dispatch(fetchUser());
    } else {
      dispatch(setLoadingUser(false));
    }
  }, [token, dispatch]);

  useEffect(() => {
    if (user && token) {
      dispatch(fetchUsersChats());
    }
  }, [user, token, dispatch]);

  useEffect(() => {
    if (guestSessionId && !user) {
      dispatch(fetchGuestChatHistory());
    }
  }, [guestSessionId, user, dispatch]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#1E2A47",
            color: "#ECEEF3",
            border: "1px solid #273350",
          },
          success: {
            duration: 3000,
            style: {
              background: "#1E2E6E",
              color: "#fff",
            },
            iconTheme: { primary: "#6FB58A", secondary: "#fff" },
          },
          error: {
            duration: 4000,
            style: {
              background: "#D0321E",
              color: "#fff",
            },
            iconTheme: { primary: "#fff", secondary: "#D0321E" },
          },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<GuestChat />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes - Use MainLayout as parent */}
        <Route path="/" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route path="chat" element={<ChatPage />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="events" element={<Events />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;
