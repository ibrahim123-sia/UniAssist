import React, { Suspense, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Sidebar from '../Sidebar';
import MobileMenuButton from '../MobileMenuButton';
import PageFallback from '../PageFallback';

const MainLayout = () => {
  const user = useSelector((s) => s.auth.user);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // If user is not logged in, redirect to guest chat
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Logged-in user layout - with sidebar
  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      {/* Sidebar for logged-in users */}
      <Sidebar
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Phone-width top bar with the menu button */}
        <MobileMenuButton
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {/* Keeps the sidebar on screen while a lazy page loads */}
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;