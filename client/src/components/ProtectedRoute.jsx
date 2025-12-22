import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const ProtectedRoute = ({ children }) => {
  const { user, loadingUser } = useAppContext();
  const location = useLocation();

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-12 h-12 border-t-4 border-blue-600 border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login but save the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;