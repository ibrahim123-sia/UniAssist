import React from "react";

// Suspense fallback for lazily loaded staff/admin pages.
const PageFallback = () => (
  <div className="flex-1 flex items-center justify-center py-16">
    <div className="w-10 h-10 border-t-4 border-[#1E2A66] dark:border-[#E63027] border-solid rounded-full animate-spin"></div>
  </div>
);

export default PageFallback;
