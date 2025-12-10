// pages/MainLayout.jsx
import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Sidebar from '../components/Sidebar';
import MobileMenuButton from '../components/MobileMenuButton';

const MainLayout = () => {
  const { user } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // If user is not logged in, redirect to guest chat
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Logged-in user layout - with sidebar
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Menu Button */}
      <MobileMenuButton 
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />
      
      {/* Sidebar for logged-in users */}
      <Sidebar 
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden md:ml-0">
        <Outlet />
      </div>
    </div>
  );
};

export default MainLayout;