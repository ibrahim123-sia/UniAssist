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
import StaffDashboard from "./staff/pages/StaffDashboard";
import Profile from "./profile/Profile";
import AdminShell from "./administrator/layout/AdminShell";
import AdminDashboard from "./administrator/pages/Dashboard";
import AdminUsers from "./administrator/pages/Users";
import AdminStaff from "./administrator/pages/Staff";
import AdminDepartments from "./administrator/pages/Departments";
import AdminQuery from "./administrator/pages/Query";
import AdminData from "./administrator/pages/Data";
import AdminLogs from "./administrator/pages/Logs";
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
            color: "#ECEEF5",
            border: "1px solid #2A3656",
          },
          success: {
            duration: 3000,
            style: {
              background: "#1E2A66",
              color: "#fff",
            },
            iconTheme: { primary: "#6FB58A", secondary: "#fff" },
          },
          error: {
            duration: 4000,
            style: {
              background: "#E63027",
              color: "#fff",
            },
            iconTheme: { primary: "#fff", secondary: "#E63027" },
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
          <Route path="staff/dashboard" element={
            <ProtectedRoute roles={["staff"]}>
              <StaffDashboard />
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

          {/* Universal — every authenticated role manages their own profile */}
          <Route path="profile" element={<Profile />} />

          {/* Admin */}
          <Route path="admin" element={
            <ProtectedRoute roles={["admin"]}>
              <AdminShell />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUsers />} />
            <Route path="staff" element={<AdminStaff />} />
            <Route path="departments" element={<AdminDepartments />} />
            <Route path="query" element={<AdminQuery />} />
            <Route path="query/:id" element={<AdminQuery />} />
            <Route path="data" element={<AdminData />} />
            <Route path="logs" element={<AdminLogs />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;
