import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import MainLayout from "./pages/MainLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatPage from "./pages/ChatPage";
import GuestChat from "./pages/GuestChat";
import Credits from "./pages/Credit";
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
            background: "#363636",
            color: "#fff",
          },
          success: {
            duration: 3000,
            style: {
              background: "#10B981",
              color: "#fff",
            },
          },
          error: {
            duration: 4000,
            style: {
              background: "#EF4444",
              color: "#fff",
            },
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
          <Route path="credits" element={<Credits />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="events" element={<Events />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;