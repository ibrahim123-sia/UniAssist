// pages/Register.jsx
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  Sun,
  Moon,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
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
  // Check if these functions exist in your AppContext
  const { theme, toggleTheme, registerUser, verifyOtp, resendOtp } =
    useAppContext();
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
      // Check if registerUser exists in context
      if (!registerUser || typeof registerUser !== "function") {
        throw new Error("registerUser function not available in context");
      }

      const result = await registerUser(name, email, password);

      if (result && result.success) {
        toast.success("OTP sent to your email");
        setStep(2);
      } else {
        toast.error(result?.message || "Registration failed");
      }
    } catch (error) {
      toast.error(error.message || "Registration failed");
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!verifyOtp || typeof verifyOtp !== "function") {
        throw new Error("verifyOtp function not available");
      }

      const result = await verifyOtp(email, otp.replace(/\s/g, ""));

      if (!result.success) {
        toast.error(result?.message || "Invalid OTP");
      }
    } catch (error) {
      toast.error(error.message || "Verification failed");
      console.error("OTP verification error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      // Check if resendOtp exists in context
      if (!resendOtp || typeof resendOtp !== "function") {
        throw new Error("resendOtp function not available in context");
      }

      const result = await resendOtp(email);

      if (result && result.success) {
        toast.success("New OTP sent to your email!");
      } else {
        toast.error(result?.message || "Failed to resend OTP");
      }
    } catch (error) {
      toast.error(error.message || "Failed to resend OTP");
      console.error("Resend OTP error:", error);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        theme === "dark"
          ? "bg-[#0F1626]"
          : "bg-linear-to-br from-[#EEF1FA] via-[#F5F6F8] to-[#EEF1FA]"
      }`}
    >
      {/* Theme Toggle */}
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

      {/* Responsive Container */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-6">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-6 sm:mb-8 lg:mb-10">
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
            className={`text-sm sm:text-base lg:text-lg text-center mb-2 ${
              theme === "dark" ? "text-[#A9B2C7]" : "text-[#5A6372]"
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
                ? "bg-[#17203A]/90 border-[#273350]"
                : "bg-white/90 border-[#E2E5EA]"
            }`}
          >
            <h2 className="text-xl sm:text-2xl font-bold text-[#222222] dark:text-[#ECEEF3] mb-2">
              {step === 1 ? "Create Account" : "Verify Email"}
            </h2>
            <p
              className={`text-sm sm:text-base mb-6 ${
                theme === "dark" ? "text-[#A9B2C7]" : "text-[#5A6372]"
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
                      theme === "dark" ? "text-[#A9B2C7]" : "text-[#222222]"
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
                      className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2E6E] dark:focus:ring-[#6E8BE0] focus:border-transparent transition-all duration-300 text-sm sm:text-base ${
                        theme === "dark"
                          ? "bg-[#121A2E] border-[#273350] text-[#ECEEF3]"
                          : "bg-[#F5F6F8] border-[#E2E5EA] text-[#222222]"
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
                      className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2E6E] dark:focus:ring-[#6E8BE0] focus:border-transparent transition-all duration-300 text-sm sm:text-base ${
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
                      className={`w-full pl-9 sm:pl-10 pr-9 sm:pr-12 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2E6E] dark:focus:ring-[#6E8BE0] focus:border-transparent transition-all duration-300 text-sm sm:text-base ${
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

                {/* Confirm Password */}
                <div>
                  <label
                    className={`block text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                      theme === "dark" ? "text-[#A9B2C7]" : "text-[#222222]"
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
                      className={`w-full pl-9 sm:pl-10 pr-9 sm:pr-12 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2E6E] dark:focus:ring-[#6E8BE0] focus:border-transparent transition-all duration-300 text-sm sm:text-base ${
                        theme === "dark"
                          ? "bg-[#121A2E] border-[#273350] text-[#ECEEF3]"
                          : "bg-[#F5F6F8] border-[#E2E5EA] text-[#222222]"
                      }`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#5A6372] dark:text-[#A9B2C7] hover:text-[#222222] dark:hover:text-[#ECEEF3]"
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
                  className="w-full bg-[#1E2E6E] hover:bg-[#162356] text-white font-semibold py-2 sm:py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
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
                      theme === "dark" ? "text-[#A9B2C7]" : "text-[#222222]"
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
                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-[#1E2E6E] dark:focus:ring-[#6E8BE0] focus:border-transparent text-center tracking-widest font-mono text-sm sm:text-base ${
                      theme === "dark"
                        ? "bg-[#121A2E] border-[#273350] text-[#ECEEF3]"
                        : "bg-[#F5F6F8] border-[#E2E5EA] text-[#222222]"
                    }`}
                    placeholder="000000"
                    maxLength="6"
                    required
                  />
                  <p
                    className={`mt-2 text-xs sm:text-sm ${
                      theme === "dark" ? "text-[#A9B2C7]" : "text-[#5A6372]"
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
                        ? "border-[#273350] text-[#A9B2C7] hover:bg-[#1E2A47]"
                        : "border-[#E2E5EA] text-[#222222] hover:bg-[#F5F6F8]"
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
                        ? "border-[#6E8BE0] text-[#6E8BE0] hover:bg-[#1E2A47]"
                        : "border-[#1E2E6E] text-[#1E2E6E] hover:bg-[#EEF1FA]"
                    } disabled:opacity-50`}
                  >
                    {loading ? "Sending..." : "Resend OTP"}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#1E2E6E] hover:bg-[#162356] text-white font-semibold py-2 sm:py-3 px-4 rounded-xl transition-colors disabled:opacity-50 text-sm sm:text-base"
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
            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-[#E2E5EA] dark:border-[#273350]">
              <p
                className={`text-center text-xs sm:text-sm ${
                  theme === "dark" ? "text-[#A9B2C7]" : "text-[#5A6372]"
                }`}
              >
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-[#D0321E] dark:text-[#E57A63] hover:text-[#B1291A] dark:hover:text-[#EE9480] font-semibold transition-colors"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </div>

          {/* Features Sidebar */}
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <div className="bg-[#1E2E6E] dark:bg-[#1E2A47] rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 text-white border-t-4 border-[#D0321E]">
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
                  ? "bg-[#17203A]/90 border-[#273350]"
                  : "bg-white/90 border-[#E2E5EA]"
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-[#6FB58A]" />
                <h4
                  className={`font-bold text-sm sm:text-base ${
                    theme === "dark" ? "text-[#ECEEF3]" : "text-[#222222]"
                  }`}
                >
                  Secure & Private
                </h4>
              </div>
              <p
                className={`text-xs sm:text-sm ${
                  theme === "dark" ? "text-[#A9B2C7]" : "text-[#5A6372]"
                }`}
              >
                Your academic data is encrypted and never shared with third
                parties.
              </p>
            </div>

            <div className="bg-[#D0321E] dark:bg-[#8A2314] rounded-2xl shadow-2xl p-4 sm:p-6 text-white">
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
                  ? "bg-[#17203A]/90 border-[#273350]"
                  : "bg-white/90 border-[#E2E5EA]"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Laptop className="w-5 h-5 text-[#1E2E6E] dark:text-[#6E8BE0]" />
                <Smartphone className="w-5 h-5 text-[#D0321E] dark:text-[#E57A63]" />
              </div>
              <p
                className={`text-xs sm:text-sm ${
                  theme === "dark" ? "text-[#A9B2C7]" : "text-[#5A6372]"
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
