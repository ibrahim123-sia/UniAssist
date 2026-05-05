import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Sidebar from '../Sidebar';
import MobileMenuButton from '../MobileMenuButton';

const MainLayout = () => {
  const user = useSelector((s) => s.auth.user);
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