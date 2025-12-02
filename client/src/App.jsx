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
import Emails from './pages/Emails';
import Deadlines from './pages/Deadlines';

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
      
        <Route path="/" element={<GuestChat />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="/emails" element={<Emails />} />
        <Route path="/deadlines" element={<Deadlines />} />
       
        <Route element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
        
        
        </Route>
      </Routes>
    </>
  );
};

export default App;