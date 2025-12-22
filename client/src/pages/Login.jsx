import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { 
  Sun, 
  Moon, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  GraduationCap,
  ArrowRight,
  Shield,
  Mail as MailIcon
} from "lucide-react";

const Login = () => {
  const { theme, setTheme, setToken,loginUser,forgotPassword,resetPassword } = useAppContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetStep, setResetStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

// Replace the handleSubmit function in Login.jsx:

// In the handleSubmit function:
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  
  // Use the loginUser function from context instead of axios
  const result = await loginUser(email, password);
  
  // Navigation is handled inside loginUser
  if (!result.success) {
    toast.error(result.message || "Login failed");
  }
  
  setLoading(false);
};
// Also update the forgot password handlers:

const handleSendOtp = async (e) => {
  e.preventDefault();
  setLoading(true);
  
  const result = await forgotPassword(resetEmail);
  
  if (result.success) {
    toast.success("OTP sent to your email");
    setResetStep(2);
  } else {
    toast.error(result.message || "Failed to send OTP");
  }
  
  setLoading(false);
};

const handlePasswordReset = async (e) => {
  e.preventDefault();
  
  if (newPassword !== confirmPassword) {
    toast.error("Passwords do not match");
    return;
  }
  
  setLoading(true);
  
  const result = await resetPassword(resetEmail, resetOtp, newPassword);
  
  if (result.success) {
    toast.success("Password reset successfully!");
    setResetStep(0);
    setResetEmail("");
    setResetOtp("");
    setNewPassword("");
    setConfirmPassword("");
  } else {
    toast.error(result.message || "Password reset failed");
  }
  
  setLoading(false);
};

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === "dark" 
        ? "bg-linear-to-br from-gray-900 via-gray-800 to-gray-900" 
        : "bg-linear-to-br from-blue-50 via-indigo-50 to-blue-100"
    }`}>
      {/* Responsive Container */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        
        {/* Theme Toggle - Responsive positioning */}
        <button
          onClick={toggleTheme}
          className="fixed top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 p-2 sm:p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 z-50"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
          ) : (
            <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
          )}
        </button>

        {/* Logo Section - Responsive */}
        <div className="flex flex-col items-center mb-6 sm:mb-8 lg:mb-12">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl">
              <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white">
              UniAssist<span className="text-blue-600 dark:text-blue-400">.ai</span>
            </h1>
          </div>
          <p className={`text-sm sm:text-base lg:text-lg text-center ${
            theme === "dark" ? "text-gray-300" : "text-gray-600"
          }`}>
            Your AI-Powered Companion for University Life at MAJU
          </p>
        </div>

        {/* Main Card - Responsive width */}
        <div className="max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto">
          <div className={`backdrop-blur-sm rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 border ${
            theme === "dark" 
              ? "bg-gray-800/80 border-gray-700/20" 
              : "bg-white/80 border-white/20"
          }`}>
            
            {resetStep === 0 ? (
              <>
                {/* Login Form */}
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2">
                  Welcome Back
                </h2>
                <p className={`text-sm sm:text-base mb-6 ${
                  theme === "dark" ? "text-gray-300" : "text-gray-600"
                }`}>
                  Sign in to your UniAssist account
                </p>

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                  {/* Email Input */}
                  <div>
                    <label className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}>
                      University Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 placeholder-gray-400 text-sm sm:text-base ${
                          theme === "dark"
                            ? "bg-gray-700 border-gray-600 text-white"
                            : "bg-gray-50 border-gray-200 text-gray-900"
                        }`}
                        placeholder="student@maju.edu.pk"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-sm sm:text-base ${
                          theme === "dark"
                            ? "bg-gray-700 border-gray-600 text-white"
                            : "bg-gray-50 border-gray-200 text-gray-900"
                        }`}
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showPassword ? 
                          <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : 
                          <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Remember & Forgot Password - Stack on mobile */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="remember"
                        className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="remember" className={`ml-2 text-xs sm:text-sm ${
                        theme === "dark" ? "text-gray-300" : "text-gray-600"
                      }`}>
                        Remember me
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResetStep(1)}
                      className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-left sm:text-right"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 sm:py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-t-2 border-white border-solid rounded-full animate-spin"></div>
                        <span className="hidden sm:inline">Signing in...</span>
                        <span className="sm:hidden">Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Register Link */}
                <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className={`text-center text-xs sm:text-sm ${
                    theme === "dark" ? "text-gray-300" : "text-gray-600"
                  }`}>
                    Don't have an account?{" "}
                    <Link
                      to="/register"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold transition-colors"
                    >
                      Create account
                    </Link>
                  </p>
                </div>
              </>
            ) : resetStep === 1 ? (
              // Forgot Password Step 1
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2">
                  Reset Password
                </h2>
                <p className={`text-sm sm:text-base mb-4 sm:mb-6 ${
                  theme === "dark" ? "text-gray-300" : "text-gray-600"
                }`}>
                  Enter your email to receive a verification code
                </p>
                <form onSubmit={handleSendOtp}>
                  <div className="mb-4 sm:mb-6">
                    <label className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}>
                      Email Address
                    </label>
                    <div className="relative">
                      <MailIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base ${
                          theme === "dark"
                            ? "bg-gray-700 border-gray-600 text-white"
                            : "bg-gray-50 border-gray-200 text-gray-900"
                        }`}
                        placeholder="student@maju.edu.pk"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setResetStep(0)}
                      className={`flex-1 py-2 sm:py-3 px-4 border rounded-xl hover:transition-colors text-sm sm:text-base ${
                        theme === "dark"
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 sm:py-3 px-4 rounded-xl transition-colors disabled:opacity-50 text-sm sm:text-base"
                    >
                      {loading ? "Sending..." : "Send OTP"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              // Forgot Password Step 2
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2">
                  Create New Password
                </h2>
                <p className={`text-sm sm:text-base mb-4 sm:mb-6 ${
                  theme === "dark" ? "text-gray-300" : "text-gray-600"
                }`}>
                  Enter the OTP and your new password
                </p>
                <form onSubmit={handlePasswordReset}>
                  <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                    {/* OTP Input */}
                    <div>
                      <label className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                        theme === "dark" ? "text-gray-300" : "text-gray-700"
                      }`}>
                        Verification Code
                      </label>
                      <input
                        type="text"
                        value={resetOtp}
                        onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center tracking-widest font-mono text-sm sm:text-base ${
                          theme === "dark"
                            ? "bg-gray-700 border-gray-600 text-white"
                            : "bg-gray-50 border-gray-200 text-gray-900"
                        }`}
                        placeholder="123456"
                        maxLength="6"
                        required
                      />
                    </div>
                    
                    {/* New Password */}
                    <div>
                      <label className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                        theme === "dark" ? "text-gray-300" : "text-gray-700"
                      }`}>
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={`w-full px-3 sm:px-4 pr-9 sm:pr-12 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base ${
                            theme === "dark"
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-gray-50 border-gray-200 text-gray-900"
                          }`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                          {showNewPassword ? 
                            <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : 
                            <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                          }
                        </button>
                      </div>
                    </div>
                    
                    {/* Confirm Password */}
                    <div>
                      <label className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                        theme === "dark" ? "text-gray-300" : "text-gray-700"
                      }`}>
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base ${
                          theme === "dark"
                            ? "bg-gray-700 border-gray-600 text-white"
                            : "bg-gray-50 border-gray-200 text-gray-900"
                        }`}
                        required
                      />
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setResetStep(1)}
                      className={`flex-1 py-2 sm:py-3 px-4 border rounded-xl hover:transition-colors text-sm sm:text-base ${
                        theme === "dark"
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 sm:py-3 px-4 rounded-xl transition-colors disabled:opacity-50 text-sm sm:text-base"
                    >
                      {loading ? "Resetting..." : "Reset Password"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Security Badge */}
            <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Your data is securely encrypted</span>
            </div>
          </div>

          {/* Features Grid - Responsive */}
          <div className="mt-4 sm:mt-6 lg:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className={`text-center p-3 sm:p-4 rounded-xl ${
              theme === "dark" 
                ? "bg-gray-800/50" 
                : "bg-white/50"
            } backdrop-blur-sm`}>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">24/7</div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Support</div>
            </div>
            <div className={`text-center p-3 sm:p-4 rounded-xl ${
              theme === "dark" 
                ? "bg-gray-800/50" 
                : "bg-white/50"
            } backdrop-blur-sm`}>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">AI</div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Powered</div>
            </div>
            <div className={`text-center p-3 sm:p-4 rounded-xl ${
              theme === "dark" 
                ? "bg-gray-800/50" 
                : "bg-white/50"
            } backdrop-blur-sm`}>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">Secure</div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Privacy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;