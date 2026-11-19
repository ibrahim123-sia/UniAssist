// components/MobileMenuButton.jsx
import React from 'react';
import { Menu } from 'lucide-react';
import BrandMark from './BrandMark';

// Phone-width top bar with the menu button. It sits in the page flow, so the
// page below starts under it (a fixed button used to cover page titles).
const MobileMenuButton = ({ isMenuOpen, setIsMenuOpen }) => {
  return (
    <header className="md:hidden shrink-0 flex items-center gap-3 px-4 h-14 border-b bg-surface border-border">
      <button
        onClick={() => setIsMenuOpen(true)}
        className="p-2 -ml-2 rounded-control text-label hover:bg-nav-hover transition-colors focus-ring"
        aria-label="Open menu"
        aria-expanded={isMenuOpen}
      >
        <Menu className="w-5 h-5" />
      </button>
      <BrandMark size={28} />
      <span className="font-bold text-heading">UniAssist</span>
    </header>
  );
};

export default MobileMenuButton;
