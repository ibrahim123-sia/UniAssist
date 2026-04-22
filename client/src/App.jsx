import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import MainLayout from "./pages/MainLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatPage from "./pages/ChatPage";
import GuestChat from "./pages/GuestChat";
import Jobs from "./pages/Job"
import Events from "./pages/Events";

const App = () => {
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