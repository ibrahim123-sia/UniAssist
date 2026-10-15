// pages/Register.jsx
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { registerUser, verifyOtp, resendOtp } from "../redux/slices/authSlice";
import ServiceNotice from "../components/ServiceNotice";
import ThemeToggle from "../components/ThemeToggle";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  BookOpen,
  Calendar,
  MessageSquare,
  ArrowRight,
  Clock,
  Smartphone,
  Laptop,
} from "lucide-react";

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  // Login hands unverified users over as { email, step: 2 } so they land
  // directly on the OTP form.
  const handoffEmail = location.state?.email || "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState(handoffEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(
    handoffEmail && location.state?.step === 2 ? 2 : 1
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Server-side blocker (503: university email not configured), shown inline.
  const [serviceIssue, setServiceIssue] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();

    // Basic validation
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const result = await dispatch(
        registerUser({ name, email, password })
      ).unwrap();

      if (result.success) {
        setServiceIssue("");
        toast.success("OTP sent to your email");
        setStep(2);
      } else if (result.emailNotConfigured) {
        setServiceIssue(result.message);
      } else {
        setServiceIssue("");
        toast.error(result.message || "Registration failed");
        // A code for this email is still live: let them enter it.
        if (result.otpPending) setStep(2);
      }
    } catch (error) {
      toast.error(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await dispatch(
        verifyOtp({ email, otp: otp.replace(/\s/g, "") })
      ).unwrap();

      if (result.success) {
        navigate("/chat", { replace: true });
      } else {
        toast.error(result.message || "Invalid OTP");
      }
    } catch (error) {
      toast.error(error.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      const result = await dispatch(resendOtp({ email })).unwrap();

      if (result.success) {
        setServiceIssue("");
        toast.success("New OTP sent to your email!");
      } else if (result.emailNotConfigured) {
        setServiceIssue(result.message);
      } else {
        toast.error(result.message || "Failed to resend OTP");
      }
    } catch (error) {
      toast.error(error.message || "Failed to resend OTP");
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 bg-bg`}
    >
      {/* Theme Toggle */}
      <ThemeToggle className="fixed top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 z-50" />

      {/* Responsive Container */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-6">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-6 sm:mb-8 lg:mb-10">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center bg-primary">
              <span className="text-on-primary font-extrabold text-2xl sm:text-3xl leading-none">M</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-heading">
              UniAssist
            </h1>
          </div>
          <p
            className={`text-sm sm:text-base lg:text-lg text-center mb-2 text-muted`}
          >
            Join thousands of MAJU students using AI to simplify university life
          </p>
        </div>

        {/* Main Content - Responsive Grid */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Registration Form */}
          <div
            className={`rounded-panel shadow-panel p-4 sm:p-6 lg:p-8 border bg-surface border-border`}
          >
            <h2 className="text-xl sm:text-2xl font-extrabold text-heading mb-2">
              {step === 1 ? "Create Account" : "Verify Email"}
            </h2>
            <p
              className={`text-sm sm:text-base mb-6 text-muted`}
            >
              {step === 1
                ? "Register with your MAJU email to get started"
                : "Enter the 6-digit code sent to your email"}
            </p>

            <ServiceNotice message={serviceIssue} />
            {step === 1 ? (
              <form
                onSubmit={handleRegister}
                className="space-y-4 sm:space-y-6"
              >
                {/* Name Input */}
                <div>
                  <label
                    className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-label`}
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-placeholder w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-xl outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-all duration-300 text-sm sm:text-base bg-input-bg border border-input-border text-text placeholder:text-placeholder`}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>

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
                      className={`w-full pl-9 sm:pl-10 pr-9 sm:pr-12 py-2 sm:py-3 rounded-xl outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-all duration-300 text-sm sm:text-base bg-input-bg border border-input-border text-text placeholder:text-placeholder`}
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

                {/* Confirm Password */}
                <div>
                  <label
                    className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-label`}
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-placeholder w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full pl-9 sm:pl-10 pr-9 sm:pr-12 py-2 sm:py-3 rounded-xl outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-all duration-300 text-sm sm:text-base bg-input-bg border border-input-border text-text placeholder:text-placeholder`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-placeholder hover:text-label focus-ring rounded-md"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                  </div>
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
                      <span className="hidden sm:inline">
                        Creating Account...
                      </span>
                      <span className="sm:hidden">Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              // OTP Verification Step
              <form
                onSubmit={handleVerifyOtp}
                className="space-y-4 sm:space-y-6"
              >
                <div>
                  <label
                    className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-label`}
                  >
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl outline-none focus:border-primary focus:shadow-[var(--focus-ring)] text-center tracking-widest font-mono text-sm sm:text-base bg-input-bg border border-input-border text-text placeholder:text-placeholder`}
                    placeholder="000000"
                    maxLength="6"
                    required
                  />
                  <p
                    className={`mt-2 text-xs sm:text-sm text-muted`}
                  >
                    Enter the 6-digit code sent to {email}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={`flex-1 py-2 sm:py-3 px-4 border rounded-xl transition-colors focus-ring text-sm sm:text-base bg-surface border-border-strong text-label hover:bg-nav-hover`}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className={`flex-1 py-2 sm:py-3 px-4 border rounded-xl transition-colors focus-ring text-sm sm:text-base bg-surface border-primary text-link hover:bg-nav-active-bg disabled:opacity-50`}
                  >
                    {loading ? "Sending..." : "Resend OTP"}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary hover:bg-primary-hover text-on-primary font-bold focus-ring py-2 sm:py-3 px-4 rounded-xl transition-colors disabled:bg-disabled-bg disabled:text-disabled-text text-sm sm:text-base"
                  >
                    {loading ? (
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-t-2 border-on-primary border-solid rounded-full animate-spin mx-auto"></div>
                    ) : (
                      "Verify & Continue"
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Login Link */}
            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-border">
              <p
                className={`text-center text-xs sm:text-sm text-muted`}
              >
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-link hover:text-link-hover font-semibold transition-colors focus-ring rounded-sm"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </div>

          {/* Features Sidebar */}
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="bg-primary rounded-card shadow-card p-4 sm:p-6 lg:p-8 text-on-primary">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-4 sm:mb-6">
                Why Join UniAssist?
              </h3>
              <div className="space-y-4 sm:space-y-6">
                {[
                  {
                    icon: MessageSquare,
                    title: "Smart Q&A",
                    desc: "Instant answers about deadlines, courses, and policies",
                  },
                  {
                    icon: Mail,
                    title: "Job Search",
                    desc: "See related job opportunities for students",
                  },
                  {
                    icon: Calendar,
                    title: "University Events",
                    desc: "Track and Apply for campus events seamlessly",
                  },
                  {
                    icon: BookOpen,
                    title: "Natural Conversations",
                    desc: "Chat naturally, no complex commands needed",
                  },
                ].map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 bg-on-primary/15 rounded-control shrink-0">
                      <feature.icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm sm:text-base lg:text-lg">
                        {feature.title}
                      </h4>
                      <p className="text-on-primary/85 text-xs sm:text-sm lg:text-base">
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`rounded-card shadow-card p-4 sm:p-6 border bg-surface border-border`}
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-accent-strong" />
                <h4
                  className={`font-bold text-sm sm:text-base text-heading`}
                >
                  Secure & Private
                </h4>
              </div>
              <p
                className={`text-xs sm:text-sm text-muted`}
              >
                Your academic data is encrypted and never shared with third
                parties.
              </p>
            </div>

            <div className="bg-surface border border-border rounded-card shadow-card p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary dark:text-link" />
                <h4 className="font-bold text-sm sm:text-base text-heading">
                  Exclusive Early Access
                </h4>
              </div>
              <p className="text-xs sm:text-sm text-muted">
                Join now and get early access to upcoming features.
              </p>
            </div>

            <div
              className={`hidden sm:block rounded-card shadow-card p-4 sm:p-6 border bg-surface border-border`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Laptop className="w-5 h-5 text-primary dark:text-link" />
                <Smartphone className="w-5 h-5 text-accent-strong" />
              </div>
              <p
                className={`text-xs sm:text-sm text-muted`}
              >
                Access UniAssist from any device
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
