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
import Issues from "./student/pages/Issues";
import CreateIssue from "./student/pages/CreateIssue";
import IssueDetail from "./student/pages/IssueDetail";
import StaffIssues from "./staff/pages/StaffIssues";
import StaffIssueDetail from "./staff/pages/StaffIssueDetail";
import { fetchUser, setLoadingUser } from "./redux/slices/authSlice";
import { fetchUsersChats } from "./redux/slices/chatSlice";
import { fetchGuestChatHistory } from "./redux/slices/guestSlice";
import { fetchDepartments } from "./redux/slices/departmentSlice";

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
      if (user.role === "student" || !user.role) {
        dispatch(fetchUsersChats());
      }
      dispatch(fetchDepartments());
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
          <Route path="chat" element={
            <ProtectedRoute roles={["student", "admin"]}>
              <ChatPage />
            </ProtectedRoute>
          } />
          <Route path="jobs" element={
            <ProtectedRoute roles={["student"]}>
              <Jobs />
            </ProtectedRoute>
          } />
          <Route path="events" element={
            <ProtectedRoute roles={["student"]}>
              <Events />
            </ProtectedRoute>
          } />
          <Route path="issues" element={
            <ProtectedRoute roles={["student"]}>
              <Issues />
            </ProtectedRoute>
          } />
          <Route path="issues/new" element={
            <ProtectedRoute roles={["student"]}>
              <CreateIssue />
            </ProtectedRoute>
          } />
          <Route path="issues/:id" element={
            <ProtectedRoute roles={["student"]}>
              <IssueDetail />
            </ProtectedRoute>
          } />
          <Route path="staff/issues" element={
            <ProtectedRoute roles={["staff"]}>
              <StaffIssues />
            </ProtectedRoute>
          } />
          <Route path="staff/issues/:id" element={
            <ProtectedRoute roles={["staff"]}>
              <StaffIssueDetail />
            </ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;
