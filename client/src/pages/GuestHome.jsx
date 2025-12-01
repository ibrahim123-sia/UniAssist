// pages/GuestHome.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  Sun,
  Moon,
  GraduationCap,
  MessageSquare,
  Mail,
  Calendar,
  BookOpen,
  Users,
  Clock,
  Shield,
  ChevronRight,
  Search,
  HelpCircle,
  Globe,
  Smartphone,
  Zap,
  CheckCircle,
  ArrowRight
} from "lucide-react";

const GuestHome = () => {
  const { theme, setTheme } = useAppContext();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("info");

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Sample FAQs for prospective students
  const faqs = [
    {
      question: "What programs does MAJU offer?",
      answer: "MAJU offers undergraduate and graduate programs in Computer Science, Business, Engineering, and more."
    },
    {
      question: "What are the admission requirements?",
      answer: "Minimum 60% in intermediate, entrance test, and interview. International students need equivalent qualifications."
    },
    {
      question: "When is the admission deadline?",
      answer: "Fall semester: August 15, Spring semester: January 15. Early applications are encouraged."
    },
    {
      question: "What is the fee structure?",
      answer: "Fees vary by program. Contact admissions office or check the official website for details."
    }
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    // In real app, this would search university data
    console.log("Searching:", searchQuery);
  };

  const handleGuestChat = () => {
    // Navigate to chatbot interface (read-only mode)
    navigate("/chat/guest");
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === "dark" 
        ? "bg-linear-to-b from-gray-900 to-gray-800" 
        : "bg-linear-to-b from-blue-50 to-white"
    }`}>
      
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 sm:top-6 sm:right-6 lg:top-5 lg:right-4 p-2 sm:p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 z-50"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
        ) : (
          <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
        )}
      </button>

      {/* Navigation Bar */}
      <nav className={`sticky top-0 z-40 backdrop-blur-lg border-b ${
        theme === "dark" 
          ? "bg-gray-900/80 border-gray-700" 
          : "bg-white/80 border-gray-200"
      }`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-linear-to-r from-blue-600 to-indigo-600 rounded-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                  UniAssist<span className="text-blue-600 dark:text-blue-400">.ai</span>
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">For Muhammad Ali Jinnah University</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Link 
                to="/login" 
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  theme === "dark"
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-700 hover:text-gray-900"
                }`}
              >
                Student Login
              </Link>
              <Link 
                to="/register" 
                className="bg-linear-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
              Welcome to{" "}
              <span className="bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                UniAssist
              </span>
            </h1>
            <p className={`text-lg sm:text-xl lg:text-2xl mb-6 sm:mb-8 ${
              theme === "dark" ? "text-gray-300" : "text-gray-600"
            }`}>
              Your AI-powered guide to Muhammad Ali Jinnah University
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask about admissions, programs, fees, deadlines..."
                  className={`w-full pl-12 pr-4 py-3 sm:py-4 rounded-xl text-sm sm:text-base shadow-lg ${
                    theme === "dark"
                      ? "bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                      : "bg-white border-gray-200 text-gray-900 placeholder-gray-500"
                  }`}
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Search
                </button>
              </form>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleGuestChat}
                className="bg-linear-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-5 h-5" />
                Start Guest Chat
              </button>
              <Link
                to="/register"
                className="bg-linear-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                Create Account
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Guest Features */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 dark:text-white mb-8 sm:mb-12">
            What You Get as a Guest
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* Guest Feature 1 */}
            <div className={`p-6 rounded-2xl backdrop-blur-sm border ${
              theme === "dark"
                ? "bg-gray-800/50 border-gray-700"
                : "bg-white/50 border-gray-200"
            }`}>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                University Information
              </h3>
              <p className={`text-sm ${
                theme === "dark" ? "text-gray-300" : "text-gray-600"
              }`}>
                Get answers about programs, faculty, campus facilities, and more
              </p>
            </div>

            {/* Guest Feature 2 */}
            <div className={`p-6 rounded-2xl backdrop-blur-sm border ${
              theme === "dark"
                ? "bg-gray-800/50 border-gray-700"
                : "bg-white/50 border-gray-200"
            }`}>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                <HelpCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Admission Queries
              </h3>
              <p className={`text-sm ${
                theme === "dark" ? "text-gray-300" : "text-gray-600"
              }`}>
                Ask about requirements, deadlines, fees, and admission process
              </p>
            </div>

            {/* Guest Feature 3 */}
            <div className={`p-6 rounded-2xl backdrop-blur-sm border ${
              theme === "dark"
                ? "bg-gray-800/50 border-gray-700"
                : "bg-white/50 border-gray-200"
            }`}>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Campus Life
              </h3>
              <p className={`text-sm ${
                theme === "dark" ? "text-gray-300" : "text-gray-600"
              }`}>
                Learn about student clubs, events, housing, and campus culture
              </p>
            </div>

            {/* Guest Feature 4 */}
            <div className={`p-6 rounded-2xl backdrop-blur-sm border ${
              theme === "dark"
                ? "bg-gray-800/50 border-gray-700"
                : "bg-white/50 border-gray-200"
            }`}>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Basic Q&A
              </h3>
              <p className={`text-sm ${
                theme === "dark" ? "text-gray-300" : "text-gray-600"
              }`}>
                24/7 access to university information and frequently asked questions
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Limitations for Guest Users */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`max-w-4xl mx-auto rounded-2xl p-6 sm:p-8 ${
            theme === "dark"
              ? "bg-gray-800/50 border border-gray-700"
              : "bg-blue-50/50 border border-blue-100"
          }`}>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6">
              ✨ Get Full Access by Registering
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Guest Access (Limited)
                </h4>
                <ul className="space-y-2">
                  <li className={`flex items-center gap-2 text-sm ${
                    theme === "dark" ? "text-gray-300" : "text-gray-600"
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    Basic university information
                  </li>
                  <li className={`flex items-center gap-2 text-sm ${
                    theme === "dark" ? "text-gray-300" : "text-gray-600"
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    Admission FAQs
                  </li>
                  <li className={`flex items-center gap-2 text-sm ${
                    theme === "dark" ? "text-gray-300" : "text-gray-600"
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    Campus tour information
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Registered Students (Full Access)
                </h4>
                <ul className="space-y-2">
                  <li className={`flex items-center gap-2 text-sm ${
                    theme === "dark" ? "text-gray-300" : "text-gray-600"
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Email automation with professors
                  </li>
                  <li className={`flex items-center gap-2 text-sm ${
                    theme === "dark" ? "text-gray-300" : "text-gray-600"
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Deadline tracking & reminders
                  </li>
                  <li className={`flex items-center gap-2 text-sm ${
                    theme === "dark" ? "text-gray-300" : "text-gray-600"
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Personal academic assistant
                  </li>
                  <li className={`flex items-center gap-2 text-sm ${
                    theme === "dark" ? "text-gray-300" : "text-gray-600"
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Course-specific Q&A
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 dark:text-white mb-8 sm:mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="max-w-3xl mx-auto">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className={`mb-4 rounded-xl border ${
                  theme === "dark"
                    ? "bg-gray-800/50 border-gray-700"
                    : "bg-white/50 border-gray-200"
                }`}
              >
                <button
                  className="w-full px-6 py-4 text-left flex items-center justify-between"
                  onClick={() => setActiveTab(activeTab === `faq-${index}` ? null : `faq-${index}`)}
                >
                  <span className={`font-medium ${
                    theme === "dark" ? "text-white" : "text-gray-900"
                  }`}>
                    {faq.question}
                  </span>
                  <ChevronRight className={`w-5 h-5 transition-transform ${
                    activeTab === `faq-${index}` ? "rotate-90" : ""
                  } ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`} />
                </button>
                {activeTab === `faq-${index}` && (
                  <div className="px-6 pb-4">
                    <p className={`text-sm ${
                      theme === "dark" ? "text-gray-300" : "text-gray-600"
                    }`}>
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-8 border-t ${
        theme === "dark" 
          ? "bg-gray-900 border-gray-800" 
          : "bg-gray-50 border-gray-200"
      }`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-linear-to-r from-blue-600 to-indigo-600 rounded-lg">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">UniAssist.ai</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  For Muhammad Ali Jinnah University
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <Link 
                to="/login" 
                className={`text-sm ${
                  theme === "dark" 
                    ? "text-gray-400 hover:text-white" 
                    : "text-gray-600 hover:text-gray-900"
                } transition-colors`}
              >
                Student Login
              </Link>
              <Link 
                to="/register" 
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                Create Account
              </Link>
              <button
                onClick={() => window.open('https://maju.edu.pk', '_blank')}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
              >
                Official Website
              </button>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800 text-center">
            <p className={`text-xs ${
              theme === "dark" ? "text-gray-500" : "text-gray-400"
            }`}>
              © {new Date().getFullYear()} UniAssist.ai - AI-powered university assistant. 
              This is an unofficial tool for educational purposes.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GuestHome;