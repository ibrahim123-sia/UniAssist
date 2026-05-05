import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, forgotPassword, resetPassword } from "../redux/slices/authSlice";
import { toggleTheme as toggleThemeAction } from "../redux/slices/themeSlice";
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
  Mail as MailIcon,
} from "lucide-react";

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useSelector((s) => s.theme.theme);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await dispatch(loginUser({ email, password })).unwrap();

    if (result.success) {
      navigate("/chat", { replace: true });
    } else {
      toast.error(result.message || "Login failed");
    }

    setLoading(false);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await dispatch(forgotPassword({ email: resetEmail })).unwrap();

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

    const result = await dispatch(
      resetPassword({ email: resetEmail, otp: resetOtp, newPassword })
    ).unwrap();

    if (result.success) {
      toast.success("Password reset successfully!");
      setResetStep(0);
      setResetEmail("");
      setResetOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } else {
      toast.error(result.message || "Password reset failed");
    }

    setLoading(false);
  };

  const toggleTheme = () => {
    dispatch(toggleThemeAction());
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        theme === "dark"
          ? "bg-[#0F1626]"
          : "bg-linear-to-br from-[#EEF1FA] via-[#F5F6F8] to-[#EEF1FA]"
      }`}
    >
      {/* Responsive Container */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-6 py-6 sm:py-10 lg:py-6">
        {/* Theme Toggle - Responsive positioning */}
        <button
          onClick={toggleTheme}
          className="fixed top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 p-2 sm:p-3 rounded-full bg-white dark:bg-[#17203A] shadow-lg hover:shadow-xl transition-all duration-300 z-50 border border-transparent dark:border-[#273350]"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-[#E0B467]" />
          ) : (
            <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-[#1E2E6E]" />
          )}
        </button>

        {/* Logo Section - Responsive */}
        <div className="flex flex-col items-center mb-4 sm:mb-8 lg:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-[#1E2E6E] dark:bg-[#1E2A47] rounded-xl">
              <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#222222] dark:text-[#ECEEF3]">
              UniAssist
              <span className="text-[#D0321E] dark:text-[#E57A63]">.ai</span>
            </h1>
          </div>
          <p
            className={`text-sm sm:text-base lg:text-lg text-center ${
              theme === "dark" ? "text-[#A9B2C7]" : "text-[#5A6372]"
            }`}
          >
            Your AI-Powered Companion for University Life at MAJU
          </p>
        </div>

        {/* Main Card - Responsive width */}
        <div className="max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto">
          <div
            className={`backdrop-blur-sm rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 border ${
              theme === "dark"
                ? "bg-[#17203A]/90 border-[#273350]"
                : "bg-white/90 border-[#E2E5EA]"
            }`}
          >
            {resetStep === 0 ? (
              <>
                {/* Login Form */}
                <h2 className="text-xl sm:text-2xl font-bold text-[#222222] dark:text-[#ECEEF3] mb-2">
                  Welcome Back
                </h2>
                <p
                  className={`text-sm sm:text-base mb-6 ${
                    theme === "dark" ? "text-[#A9B2C7]" : "text-[#5A6372]"
                  }`}
                >
                  Sign in to your UniAssist account
                </p>

                <form
                  onSubmit={handleSubmit}
                  className="space-y-4 sm:space-y-6"
                >
                  {/* Email Input */}
                  <div>
                    <label
                      className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                        theme === "dark" ? "text-[#A9B2C7]" : "text-[#222222]"
                      }`}
                    >
                      University Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2E6E] dark:focus:ring-[#6E8BE0] focus:border-transparent transition-all duration-300 placeholder-gray-400 text-sm sm:text-base ${
                          theme === "dark"
                            ? "bg-[#121A2E] border-[#273350] text-[#ECEEF3]"
                            : "bg-[#F5F6F8] border-[#E2E5EA] text-[#222222]"
                        }`}
                        placeholder="student@maju.edu.pk"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label
                      className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                        theme === "dark" ? "text-[#A9B2C7]" : "text-[#222222]"
                      }`}
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2E6E] dark:focus:ring-[#6E8BE0] focus:border-transparent transition-all duration-300 text-sm sm:text-base ${
                          theme === "dark"
                            ? "bg-[#121A2E] border-[#273350] text-[#ECEEF3]"
                            : "bg-[#F5F6F8] border-[#E2E5EA] text-[#222222]"
                        }`}
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#5A6372] dark:text-[#A9B2C7] hover:text-[#222222] dark:hover:text-[#ECEEF3]"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember & Forgot Password - Stack on mobile */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                   
                    <button
                      type="button"
                      onClick={() => setResetStep(1)}
                      className="cursor-pointer text-xs sm:text-sm text-[#1E2E6E] dark:text-[#6E8BE0] hover:text-[#162356] dark:hover:text-[#8AA3E8] transition-colors text-left sm:text-right"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#1E2E6E] hover:bg-[#162356] text-white font-semibold py-2 sm:py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
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
                <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-[#E2E5EA] dark:border-[#273350]">
                  <p
                    className={`text-center text-xs sm:text-sm ${
                      theme === "dark" ? "text-[#A9B2C7]" : "text-[#5A6372]"
                    }`}
                  >
                    Don't have an account?{" "}
                    <Link
                      to="/register"
                      className="text-[#D0321E] dark:text-[#E57A63] hover:text-[#B1291A] dark:hover:text-[#EE9480] font-semibold transition-colors"
                    >
                      Create account
                    </Link>
                  </p>
                </div>
              </>
            ) : resetStep === 1 ? (
              // Forgot Password Step 1
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#222222] dark:text-[#ECEEF3] mb-2">
                  Reset Password
                </h2>
                <p
                  className={`text-sm sm:text-base mb-4 sm:mb-6 ${
                    theme === "dark" ? "text-[#A9B2C7]" : "text-[#5A6372]"
                  }`}
                >
                  Enter your email to receive a verification code
                </p>
                <form onSubmit={handleSendOtp}>
                  <div className="mb-4 sm:mb-6">
                    <label
                      className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                        theme === "dark" ? "text-[#A9B2C7]" : "text-[#222222]"
                      }`}
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <MailIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2E6E] dark:focus:ring-[#6E8BE0] focus:border-transparent text-sm sm:text-base ${
                          theme === "dark"
                            ? "bg-[#121A2E] border-[#273350] text-[#ECEEF3]"
                            : "bg-[#F5F6F8] border-[#E2E5EA] text-[#222222]"
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
                          ? "border-[#273350] text-[#A9B2C7] hover:bg-[#1E2A47]"
                          : "border-[#E2E5EA] text-[#5A6372] hover:bg-[#F5F6F8]"
                      }`}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-[#1E2E6E] hover:bg-[#162356] text-white font-semibold py-2 sm:py-3 px-4 rounded-xl transition-colors disabled:opacity-50 text-sm sm:text-base"
                    >
                      {loading ? "Sending..." : "Send OTP"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              // Forgot Password Step 2
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#222222] dark:text-[#ECEEF3] mb-2">
                  Create New Password
                </h2>
                <p
                  className={`text-sm sm:text-base mb-4 sm:mb-6 ${
                    theme === "dark" ? "text-[#A9B2C7]" : "text-[#5A6372]"
                  }`}
                >
                  Enter the OTP and your new password
                </p>
                <form onSubmit={handlePasswordReset}>
                  <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                    {/* OTP Input */}
                    <div>
                      <label
                        className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                          theme === "dark" ? "text-[#A9B2C7]" : "text-[#222222]"
                        }`}
                      >
                        Verification Code
                      </label>
                      <input
                        type="text"
                        value={resetOtp}
                        onChange={(e) =>
                          setResetOtp(
                            e.target.value.replace(/\D/g, "").slice(0, 6)
                          )
                        }
                        className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2E6E] dark:focus:ring-[#6E8BE0] focus:border-transparent text-center tracking-widest font-mono text-sm sm:text-base ${
                          theme === "dark"
                            ? "bg-[#121A2E] border-[#273350] text-[#ECEEF3]"
                            : "bg-[#F5F6F8] border-[#E2E5EA] text-[#222222]"
                        }`}
                        placeholder="123456"
                        maxLength="6"
                        required
                      />
                    </div>

                    {/* New Password */}
                    <div>
                      <label
                        className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                          theme === "dark" ? "text-[#A9B2C7]" : "text-[#222222]"
                        }`}
                      >
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={`w-full px-3 sm:px-4 pr-9 sm:pr-12 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2E6E] dark:focus:ring-[#6E8BE0] focus:border-transparent text-sm sm:text-base ${
                            theme === "dark"
                              ? "bg-[#121A2E] border-[#273350] text-[#ECEEF3]"
                              : "bg-[#F5F6F8] border-[#E2E5EA] text-[#222222]"
                          }`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label
                        className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                          theme === "dark" ? "text-[#A9B2C7]" : "text-[#222222]"
                        }`}
                      >
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2E6E] dark:focus:ring-[#6E8BE0] focus:border-transparent text-sm sm:text-base ${
                          theme === "dark"
                            ? "bg-[#121A2E] border-[#273350] text-[#ECEEF3]"
                            : "bg-[#F5F6F8] border-[#E2E5EA] text-[#222222]"
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
                          ? "border-[#273350] text-[#A9B2C7] hover:bg-[#1E2A47]"
                          : "border-[#E2E5EA] text-[#5A6372] hover:bg-[#F5F6F8]"
                      }`}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-[#1E2E6E] hover:bg-[#162356] text-white font-semibold py-2 sm:py-3 px-4 rounded-xl transition-colors disabled:opacity-50 text-sm sm:text-base"
                    >
                      {loading ? "Resetting..." : "Reset Password"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Security Badge */}
            <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2 text-xs sm:text-sm text-[#5A6372] dark:text-[#A9B2C7]">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Your data is securely encrypted</span>
            </div>
          </div>

          {/* Features Grid - Responsive */}
          <div className="mt-4 sm:mt-6 lg:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div
              className={`text-center p-3 sm:p-4 rounded-xl ${
                theme === "dark" ? "bg-[#17203A]/60 border border-[#273350]" : "bg-white/60 border border-[#E2E5EA]"
              } backdrop-blur-sm`}
            >
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-[#1E2E6E] dark:text-[#6E8BE0]">
                24/7
              </div>
              <div className="text-xs sm:text-sm text-[#5A6372] dark:text-[#A9B2C7]">
                Support
              </div>
            </div>
            <div
              className={`text-center p-3 sm:p-4 rounded-xl ${
                theme === "dark" ? "bg-[#17203A]/60 border border-[#273350]" : "bg-white/60 border border-[#E2E5EA]"
              } backdrop-blur-sm`}
            >
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-[#D0321E] dark:text-[#E57A63]">
                AI
              </div>
              <div className="text-xs sm:text-sm text-[#5A6372] dark:text-[#A9B2C7]">
                Powered
              </div>
            </div>
            <div
              className={`text-center p-3 sm:p-4 rounded-xl ${
                theme === "dark" ? "bg-[#17203A]/60 border border-[#273350]" : "bg-white/60 border border-[#E2E5EA]"
              } backdrop-blur-sm`}
            >
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-[#1E2E6E] dark:text-[#6E8BE0]">
                Secure
              </div>
              <div className="text-xs sm:text-sm text-[#5A6372] dark:text-[#A9B2C7]">
                Privacy
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
