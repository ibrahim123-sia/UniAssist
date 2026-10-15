import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  loginUser,
  forgotPassword,
  resetPassword,
  resendOtp,
} from "../redux/slices/authSlice";
import ServiceNotice from "../components/ServiceNotice";
import ThemeToggle from "../components/ThemeToggle";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Mail as MailIcon,
} from "lucide-react";

// Top-level path sections each role may open; mirrors the role guards in
// App.jsx so a stale `from` can't bounce the user through a redirect.
const ROLE_PATHS = {
  student: ["/chat", "/jobs", "/events", "/scholarships", "/issues", "/questions", "/profile"],
  staff: ["/staff", "/profile"],
  admin: ["/admin", "/profile"],
};

const roleHome = (role) =>
  role === "staff" ? "/staff/dashboard" : role === "admin" ? "/admin/dashboard" : "/chat";

const isPathAllowed = (pathname, role) =>
  (ROLE_PATHS[role] || ROLE_PATHS.student).some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetStep, setResetStep] = useState(0);
  // Server-side blocker (503: university email not configured), shown inline.
  const [serviceIssue, setServiceIssue] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await dispatch(loginUser({ email, password })).unwrap();

    if (result.success) {
      const role = result.user?.role;
      const from = location.state?.from;
      const dest =
        from?.pathname && isPathAllowed(from.pathname, role)
          ? `${from.pathname}${from.search || ""}${from.hash || ""}`
          : roleHome(role);
      navigate(dest, { replace: true });
    } else if (result.needsVerification) {
      // Send a fresh code and hand off to Register's OTP step.
      const resent = await dispatch(resendOtp({ email: result.email })).unwrap();
      if (resent.success) {
        toast.success("Your email isn't verified yet. We sent you a new code.");
      } else {
        toast.error(resent.message || result.message);
      }
      navigate("/register", { state: { email: result.email, step: 2 } });
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
      setServiceIssue("");
      toast.success("OTP sent to your email");
      setResetStep(2);
    } else if (result.emailNotConfigured) {
      setServiceIssue(result.message);
    } else {
      setServiceIssue("");
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

  return (
    <div
      className={`min-h-screen transition-colors duration-300 bg-bg`}
    >
      {/* Responsive Container */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-6 py-6 sm:py-10 lg:py-6">
        {/* Theme Toggle */}
        <ThemeToggle className="fixed top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 z-50" />

        {/* Logo Section - Responsive */}
        <div className="flex flex-col items-center mb-4 sm:mb-8 lg:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center bg-primary">
              <span className="text-on-primary font-extrabold text-2xl sm:text-3xl leading-none">M</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-heading">
              UniAssist
            </h1>
          </div>
          <p
            className={`text-sm sm:text-base lg:text-lg text-center text-muted`}
          >
            Your AI-Powered Companion for University Life at MAJU
          </p>
        </div>

        {/* Main Card - Responsive width */}
        <div className="max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto">
          <div
            className={`rounded-panel shadow-panel p-4 sm:p-6 lg:p-8 border bg-surface border-border`}
          >
            {resetStep === 0 ? (
              <>
                {/* Login Form */}
                <h2 className="text-xl sm:text-2xl font-extrabold text-heading mb-2">
                  Welcome Back
                </h2>
                <p
                  className={`text-sm sm:text-base mb-6 text-muted`}
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
                      className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-label`}
                    >
                      University Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-placeholder w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-xl outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-all duration-300 text-sm sm:text-base bg-input-bg border border-input-border text-text placeholder:text-placeholder`}
                        placeholder="student@maju.edu.pk"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label
                      className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-label`}
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-placeholder w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2 sm:py-3 rounded-xl outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-all duration-300 text-sm sm:text-base bg-input-bg border border-input-border text-text placeholder:text-placeholder`}
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-placeholder hover:text-label focus-ring rounded-md"
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
                      className="cursor-pointer text-xs sm:text-sm text-link hover:text-link-hover font-semibold transition-colors focus-ring rounded-sm text-left sm:text-right"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary-hover text-on-primary font-bold focus-ring py-2 sm:py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:bg-disabled-bg disabled:text-disabled-text text-sm sm:text-base"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-t-2 border-on-primary border-solid rounded-full animate-spin"></div>
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
                <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-border">
                  <p
                    className={`text-center text-xs sm:text-sm text-muted`}
                  >
                    Don't have an account?{" "}
                    <Link
                      to="/register"
                      className="text-link hover:text-link-hover font-semibold transition-colors focus-ring rounded-sm"
                    >
                      Create account
                    </Link>
                  </p>
                </div>
              </>
            ) : resetStep === 1 ? (
              // Forgot Password Step 1
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-heading mb-2">
                  Reset Password
                </h2>
                <p
                  className={`text-sm sm:text-base mb-4 sm:mb-6 text-muted`}
                >
                  Enter your account email to receive a verification code
                </p>
                <ServiceNotice message={serviceIssue} />
                <form onSubmit={handleSendOtp}>
                  <div className="mb-4 sm:mb-6">
                    <label
                      className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-label`}
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <MailIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-placeholder w-4 h-4 sm:w-5 sm:h-5" />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-xl outline-none focus:border-primary focus:shadow-[var(--focus-ring)] text-sm sm:text-base bg-input-bg border border-input-border text-text placeholder:text-placeholder`}
                        placeholder="you@maju.edu.pk"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setServiceIssue("");
                        setResetStep(0);
                      }}
                      className={`flex-1 py-2 sm:py-3 px-4 border rounded-xl transition-colors focus-ring text-sm sm:text-base bg-surface border-border-strong text-label hover:bg-nav-hover`}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-primary hover:bg-primary-hover text-on-primary font-bold focus-ring py-2 sm:py-3 px-4 rounded-xl transition-colors disabled:bg-disabled-bg disabled:text-disabled-text text-sm sm:text-base"
                    >
                      {loading ? "Sending..." : "Send OTP"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              // Forgot Password Step 2
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-heading mb-2">
                  Create New Password
                </h2>
                <p
                  className={`text-sm sm:text-base mb-4 sm:mb-6 text-muted`}
                >
                  Enter the OTP and your new password
                </p>
                <form onSubmit={handlePasswordReset}>
                  <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                    {/* OTP Input */}
                    <div>
                      <label
                        className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-label`}
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
                        className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl outline-none focus:border-primary focus:shadow-[var(--focus-ring)] text-center tracking-widest font-mono text-sm sm:text-base bg-input-bg border border-input-border text-text placeholder:text-placeholder`}
                        placeholder="123456"
                        maxLength="6"
                        required
                      />
                    </div>

                    {/* New Password */}
                    <div>
                      <label
                        className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-label`}
                      >
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={`w-full px-3 sm:px-4 pr-9 sm:pr-12 py-2 sm:py-3 rounded-xl outline-none focus:border-primary focus:shadow-[var(--focus-ring)] text-sm sm:text-base bg-input-bg border border-input-border text-text placeholder:text-placeholder`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          aria-label={showNewPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-placeholder hover:text-label focus-ring rounded-md"
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
                        className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-label`}
                      >
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl outline-none focus:border-primary focus:shadow-[var(--focus-ring)] text-sm sm:text-base bg-input-bg border border-input-border text-text placeholder:text-placeholder`}
                        required
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setResetStep(1)}
                      className={`flex-1 py-2 sm:py-3 px-4 border rounded-xl transition-colors focus-ring text-sm sm:text-base bg-surface border-border-strong text-label hover:bg-nav-hover`}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-primary hover:bg-primary-hover text-on-primary font-bold focus-ring py-2 sm:py-3 px-4 rounded-xl transition-colors disabled:bg-disabled-bg disabled:text-disabled-text text-sm sm:text-base"
                    >
                      {loading ? "Resetting..." : "Reset Password"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Security Badge */}
            <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2 text-xs sm:text-sm text-muted">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Your data is securely encrypted</span>
            </div>
          </div>

          {/* Features Grid - Responsive */}
          <div className="mt-4 sm:mt-6 lg:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div
              className={`text-center p-3 sm:p-4 rounded-xl bg-surface border border-border backdrop-blur-sm`}
            >
              <div className="text-lg sm:text-xl lg:text-2xl font-extrabold text-link">
                24/7
              </div>
              <div className="text-xs sm:text-sm text-muted">
                Support
              </div>
            </div>
            <div
              className={`text-center p-3 sm:p-4 rounded-xl bg-surface border border-border backdrop-blur-sm`}
            >
              <div className="text-lg sm:text-xl lg:text-2xl font-extrabold text-accent-strong">
                AI
              </div>
              <div className="text-xs sm:text-sm text-muted">
                Powered
              </div>
            </div>
            <div
              className={`text-center p-3 sm:p-4 rounded-xl bg-surface border border-border backdrop-blur-sm`}
            >
              <div className="text-lg sm:text-xl lg:text-2xl font-extrabold text-link">
                Secure
              </div>
              <div className="text-xs sm:text-sm text-muted">
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
