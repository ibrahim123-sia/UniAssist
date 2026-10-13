import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import MainLayout from "./components/layouts/MainLayout";
import PageFallback from "./components/PageFallback";
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
import Scholarship from "./student/pages/Scholarship";
import MyQuestions from "./student/pages/MyQuestions";
import Profile from "./profile/Profile";
import { fetchUser, setLoadingUser } from "./redux/slices/authSlice";
import { fetchUsersChats } from "./redux/slices/chatSlice";
import { fetchGuestChatHistory } from "./redux/slices/guestSlice";
import { fetchDepartments } from "./redux/slices/departmentSlice";

// Staff and admin pages (recharts, big tables) are only needed by those
// roles, so they load on demand instead of bloating the student bundle.
const StaffIssues = lazy(() => import("./staff/pages/StaffIssues"));
const StaffIssueDetail = lazy(() => import("./staff/pages/StaffIssueDetail"));
const StaffDashboard = lazy(() => import("./staff/pages/StaffDashboard"));
const AdminShell = lazy(() => import("./administrator/layout/AdminShell"));
const AdminDashboard = lazy(() => import("./administrator/pages/Dashboard"));
const AdminUsers = lazy(() => import("./administrator/pages/Users"));
const AdminStaff = lazy(() => import("./administrator/pages/Staff"));
const AdminDepartments = lazy(() => import("./administrator/pages/Departments"));
const AdminQuery = lazy(() => import("./administrator/pages/Query"));
const AdminData = lazy(() => import("./administrator/pages/Data"));
const AdminLogs = lazy(() => import("./administrator/pages/Logs"));
const AdminListings = lazy(() => import("./administrator/pages/Listings"));
const AdminQuestions = lazy(() => import("./administrator/pages/Questions"));
const AdminHealth = lazy(() => import("./administrator/pages/Health"));
const AdminSettings = lazy(() => import("./administrator/pages/Settings"));

const App = () => {
  const dispatch = useDispatch();
  const theme = useSelector((s) => s.theme.theme);
  const token = useSelector((s) => s.auth.token);
  const user = useSelector((s) => s.auth.user);
  const userId = user?._id;
  const userRole = user?.role;
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

  // Keyed on id/role, not the user object: profile edits and the
  // login + fetchUser pair replace the object without changing who it is.
  useEffect(() => {
    if (userId && token) {
      if (userRole === "student" || !userRole) {
        dispatch(fetchUsersChats());
      }
      dispatch(fetchDepartments());
    }
  }, [userId, userRole, token, dispatch]);

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
      <Suspense fallback={<PageFallback />}>
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
            <ProtectedRoute roles={["student"]}>
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
          <Route path="scholarships" element={
            <ProtectedRoute roles={["student"]}>
              <Scholarship />
            </ProtectedRoute>
          } />
          <Route path="questions" element={
            <ProtectedRoute roles={["student"]}>
              <MyQuestions />
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
            <Route path="listings" element={<AdminListings />} />
            <Route path="questions" element={<AdminQuestions />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="health" element={<AdminHealth />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
};

export default App;
