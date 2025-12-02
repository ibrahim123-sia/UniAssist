// App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from "react-hot-toast";
import MainLayout from './pages/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import ChatPage from './pages/ChatPage';
import GuestChat from './pages/GuestChat';
import Credits from './pages/Credit';

const App = () => {
  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
      <Routes>
        {/* Guest Chat is now the homepage */}
        <Route path="/" element={<GuestChat />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/credits" element={<Credits />} />
        
        {/* Protected Routes with Layout (for logged-in users) */}
        <Route element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route path="/chat" element={<ChatPage />} />
          {/* Add more protected routes as needed */}
        </Route>
      </Routes>
    </>
  );
};

export default App;