// components/MobileMenuButton.jsx
import React from 'react';
import { Menu } from 'lucide-react';

const MobileMenuButton = ({ isMenuOpen, setIsMenuOpen }) => {
  return (
    <button
      onClick={() => setIsMenuOpen(true)}
      className={`md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg transition-all ${
        isMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
    </button>
  );
};

export default MobileMenuButton;