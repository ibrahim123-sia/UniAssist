// pages/Register.jsx
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { registerUser, verifyOtp, resendOtp } from "../redux/slices/authSlice";
import { toggleTheme } from "../redux/slices/themeSlice";
import {
  Sun,
  Moon,
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
  const theme = useSelector((s) => s.theme.theme);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
        toast.success("OTP sent to your email");
        setStep(2);
      } else {
        toast.error(result.message || "Registration failed");
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
        toast.success("New OTP sent to your email!");
      } else {
        toast.error(result.message || "Failed to resend OTP");
      }
    } catch (error) {
      toast.error(error.message || "Failed to resend OTP");
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        theme === "dark"
          ? "bg-[#0E1422]"
          : "bg-linear-to-br from-[#E7E8F0] via-[#F2F3F8] to-[#E7E8F0]"
      }`}
    >
      {/* Theme Toggle */}
      <button
        onClick={() => dispatch(toggleTheme())}
        className="fixed top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 p-2 sm:p-3 rounded-full bg-white dark:bg-[#16203A] shadow-lg hover:shadow-xl transition-all duration-300 z-50 border border-transparent dark:border-[#2A3656]"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-[#E0B467]" />
        ) : (
          <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-[#1E2A66]" />
        )}
      </button>

      {/* Responsive Container */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-6">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-6 sm:mb-8 lg:mb-10">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center relative bg-[#1E2A66] dark:bg-[#1E2A47]">
              <span className="text-white font-bold text-2xl sm:text-3xl leading-none">M</span>
              <span className="absolute -bottom-1 left-2 right-2 h-0.5 rounded-full bg-[#E63027]" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1F2330] dark:text-[#ECEEF5]">
              UniAssist
            </h1>
          </div>
          <p
            className={`text-sm sm:text-base lg:text-lg text-center mb-2 ${
              theme === "dark" ? "text-[#9AA5BD]" : "text-[#5A6372]"
            }`}
          >
            Join thousands of MAJU students using AI to simplify university life
          </p>
        </div>

        {/* Main Content - Responsive Grid */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Registration Form */}
          <div
            className={`backdrop-blur-sm rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 border ${
              theme === "dark"
                ? "bg-[#16203A]/90 border-[#2A3656]"
                : "bg-white/90 border-[#D8DAE6]"
            }`}
          >
            <h2 className="text-xl sm:text-2xl font-bold text-[#1F2330] dark:text-[#ECEEF5] mb-2">
              {step === 1 ? "Create Account" : "Verify Email"}
            </h2>
            <p
              className={`text-sm sm:text-base mb-6 ${
                theme === "dark" ? "text-[#9AA5BD]" : "text-[#5A6372]"
              }`}
            >
              {step === 1
                ? "Register with your MAJU email to get started"
                : "Enter the 6-digit code sent to your email"}
            </p>

            {step === 1 ? (
              <form
                onSubmit={handleRegister}
                className="space-y-4 sm:space-y-6"
              >
                {/* Name Input */}
                <div>
                  <label
                    className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                      theme === "dark" ? "text-[#9AA5BD]" : "text-[#1F2330]"
                    }`}
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2A66] dark:focus:ring-[#E63027] focus:border-transparent transition-all duration-300 text-sm sm:text-base ${
                        theme === "dark"
                          ? "bg-[#0B1120] border-[#2A3656] text-[#ECEEF5]"
                          : "bg-[#F2F3F8] border-[#D8DAE6] text-[#1F2330]"
                      }`}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>

                {/* Email Input */}
                <div>
                  <label
                    className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                      theme === "dark" ? "text-[#9AA5BD]" : "text-[#1F2330]"
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
                      className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2A66] dark:focus:ring-[#E63027] focus:border-transparent transition-all duration-300 text-sm sm:text-base ${
                        theme === "dark"
                          ? "bg-[#0B1120] border-[#2A3656] text-[#ECEEF5]"
                          : "bg-[#F2F3F8] border-[#D8DAE6] text-[#1F2330]"
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
                      theme === "dark" ? "text-[#9AA5BD]" : "text-[#1F2330]"
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
                      className={`w-full pl-9 sm:pl-10 pr-9 sm:pr-12 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2A66] dark:focus:ring-[#E63027] focus:border-transparent transition-all duration-300 text-sm sm:text-base ${
                        theme === "dark"
                          ? "bg-[#0B1120] border-[#2A3656] text-[#ECEEF5]"
                          : "bg-[#F2F3F8] border-[#D8DAE6] text-[#1F2330]"
                      }`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#5A6372] dark:text-[#9AA5BD] hover:text-[#1F2330] dark:hover:text-[#ECEEF5]"
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
                    className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                      theme === "dark" ? "text-[#9AA5BD]" : "text-[#1F2330]"
                    }`}
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full pl-9 sm:pl-10 pr-9 sm:pr-12 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2A66] dark:focus:ring-[#E63027] focus:border-transparent transition-all duration-300 text-sm sm:text-base ${
                        theme === "dark"
                          ? "bg-[#0B1120] border-[#2A3656] text-[#ECEEF5]"
                          : "bg-[#F2F3F8] border-[#D8DAE6] text-[#1F2330]"
                      }`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#5A6372] dark:text-[#9AA5BD] hover:text-[#1F2330] dark:hover:text-[#ECEEF5]"
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
                  className="w-full bg-[#1E2A66] hover:bg-[#16204D] text-white font-semibold py-2 sm:py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-t-2 border-white border-solid rounded-full animate-spin"></div>
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
                    className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                      theme === "dark" ? "text-[#9AA5BD]" : "text-[#1F2330]"
                    }`}
                  >
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2A66] dark:focus:ring-[#E63027] focus:border-transparent text-center tracking-widest font-mono text-sm sm:text-base ${
                      theme === "dark"
                        ? "bg-[#0B1120] border-[#2A3656] text-[#ECEEF5]"
                        : "bg-[#F2F3F8] border-[#D8DAE6] text-[#1F2330]"
                    }`}
                    placeholder="000000"
                    maxLength="6"
                    required
                  />
                  <p
                    className={`mt-2 text-xs sm:text-sm ${
                      theme === "dark" ? "text-[#9AA5BD]" : "text-[#5A6372]"
                    }`}
                  >
                    Enter the 6-digit code sent to {email}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={`flex-1 py-2 sm:py-3 px-4 border rounded-xl hover:transition-colors text-sm sm:text-base ${
                      theme === "dark"
                        ? "border-[#2A3656] text-[#9AA5BD] hover:bg-[#1E2A47]"
                        : "border-[#D8DAE6] text-[#1F2330] hover:bg-[#F2F3F8]"
                    }`}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className={`flex-1 py-2 sm:py-3 px-4 border rounded-xl hover:transition-colors text-sm sm:text-base ${
                      theme === "dark"
                        ? "border-[#E63027] text-[#E63027] hover:bg-[#1E2A47]"
                        : "border-[#1E2A66] text-[#1E2A66] hover:bg-[#E7E8F0]"
                    } disabled:opacity-50`}
                  >
                    {loading ? "Sending..." : "Resend OTP"}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#1E2A66] hover:bg-[#16204D] text-white font-semibold py-2 sm:py-3 px-4 rounded-xl transition-colors disabled:opacity-50 text-sm sm:text-base"
                  >
                    {loading ? (
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-t-2 border-white border-solid rounded-full animate-spin mx-auto"></div>
                    ) : (
                      "Verify & Continue"
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Login Link */}
            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-[#D8DAE6] dark:border-[#2A3656]">
              <p
                className={`text-center text-xs sm:text-sm ${
                  theme === "dark" ? "text-[#9AA5BD]" : "text-[#5A6372]"
                }`}
              >
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-[#E63027] dark:text-[#C48A4A] hover:text-[#C81E15] dark:hover:text-[#D4625A] font-semibold transition-colors"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </div>

          {/* Features Sidebar */}
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="bg-[#1E2A66] dark:bg-[#1E2A47] rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 text-white border-t-4 border-[#E63027]">
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
                    <div className="p-2 bg-white/20 rounded-lg shrink-0">
                      <feature.icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm sm:text-base lg:text-lg">
                        {feature.title}
                      </h4>
                      <p className="text-white/80 text-xs sm:text-sm lg:text-base">
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`backdrop-blur-sm rounded-2xl shadow-2xl p-4 sm:p-6 border ${
                theme === "dark"
                  ? "bg-[#16203A]/90 border-[#2A3656]"
                  : "bg-white/90 border-[#D8DAE6]"
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-[#6FB58A]" />
                <h4
                  className={`font-bold text-sm sm:text-base ${
                    theme === "dark" ? "text-[#ECEEF5]" : "text-[#1F2330]"
                  }`}
                >
                  Secure & Private
                </h4>
              </div>
              <p
                className={`text-xs sm:text-sm ${
                  theme === "dark" ? "text-[#9AA5BD]" : "text-[#5A6372]"
                }`}
              >
                Your academic data is encrypted and never shared with third
                parties.
              </p>
            </div>

            <div className="bg-[#E63027] dark:bg-[#A82018] rounded-2xl shadow-2xl p-4 sm:p-6 text-white">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                <h4 className="font-bold text-sm sm:text-base">
                  Exclusive Early Access
                </h4>
              </div>
              <p className="text-xs sm:text-sm opacity-90">
                Join now and get early access to upcoming features.
              </p>
            </div>

            <div
              className={`hidden sm:block backdrop-blur-sm rounded-2xl shadow-2xl p-4 sm:p-6 border ${
                theme === "dark"
                  ? "bg-[#16203A]/90 border-[#2A3656]"
                  : "bg-white/90 border-[#D8DAE6]"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Laptop className="w-5 h-5 text-[#1E2A66] dark:text-[#E63027]" />
                <Smartphone className="w-5 h-5 text-[#E63027] dark:text-[#C48A4A]" />
              </div>
              <p
                className={`text-xs sm:text-sm ${
                  theme === "dark" ? "text-[#9AA5BD]" : "text-[#5A6372]"
                }`}
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
