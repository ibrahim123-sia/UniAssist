import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  sendGuestMessage,
  clearGuestSession,
} from "../redux/slices/guestSlice";
import { toggleTheme as toggleThemeAction } from "../redux/slices/themeSlice";
import {
  Send,
  Brain,
  Sun,
  Moon,
  Mail,
  Calendar,
  Book,
  Info,
  Sparkles,
  Users,
  Building,
  Wallet,
  X,
  RotateCcw,
  Trash2,
  MessageCircle,
} from "lucide-react";
import toast from "react-hot-toast";

const GuestChat = () => {
  const dispatch = useDispatch();
  const theme = useSelector((s) => s.theme.theme);
  const guestMessages = useSelector((s) => s.guest.guestMessages);
  const guestSessionId = useSelector((s) => s.guest.guestSessionId);

  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleTheme = () => {
    dispatch(toggleThemeAction());
  };

  // Improved scrollToBottom function
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollHeight, clientHeight } = messagesContainerRef.current;
      messagesContainerRef.current.scrollTo({
        top: scrollHeight,
        behavior: "smooth"
      });
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [guestMessages]);

  // Also scroll when loading state changes (when response starts coming)
  useEffect(() => {
    if (!isLoading) {
      // Small delay to ensure DOM is updated
      setTimeout(scrollToBottom, 100);
    }
  }, [isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);
    
    // Scroll immediately when user sends message
    setTimeout(scrollToBottom, 50);

    try {
      const result = await dispatch(
        sendGuestMessage({ message: userMessage })
      ).unwrap();

      if (!result.success) {
        toast.error(result.message || "Failed to send message");
      }

      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to get response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedTopic = async (topic) => {
    setInputMessage(topic);
    // Auto-send after a short delay
    setTimeout(() => {
      document.querySelector('button[type="submit"]')?.click();
    }, 100);
  };

  const handleClearChat = () => {
    dispatch(clearGuestSession());
    toast.success("Chat cleared. Start a new conversation.");
  };

  const suggestedTopics = [
    {
      icon: <Book className="w-4 h-4" />,
      text: "What programs does MAJU offer?",
    },
    { icon: <Users className="w-4 h-4" />, text: "Admission requirements?" },
    { icon: <Calendar className="w-4 h-4" />, text: "Application deadlines?" },
    { icon: <Wallet className="w-4 h-4" />, text: "Fee structure?" },
    { icon: <Building className="w-4 h-4" />, text: "Campus facilities?" },
    {
      icon: <MessageCircle className="w-4 h-4" />,
      text: "Contact information?",
    },
  ];

  // Format messages from context for display
  const displayMessages = guestMessages.map((msg, index) => ({
    id: index,
    text: msg.content,
    sender: msg.role === "user" ? "user" : "bot",
    timestamp: msg.timestamp || Date.now(),
    type: msg.type || "text",
  }));

  return (
    <div
      className={`flex h-screen ${
        theme === "dark"
          ? "bg-[#0E1422]"
          : "bg-linear-to-b from-[#E7E8F0] via-white to-[#F2F3F8]"
      }`}
    >
      {/* Mobile Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar for Guests */}
      <div
        className={`flex flex-col h-screen w-64 ${
          theme === "dark"
            ? "bg-[#16203A]/95 border-[#2A3656] backdrop-blur-lg"
            : "bg-white/95 border-[#D8DAE6] backdrop-blur-lg"
        } border-r transition-transform duration-300 fixed md:relative z-40
      ${isMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Close button for mobile */}
        <button
          onClick={() => setIsMenuOpen(false)}
          className="md:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-[#F2F3F8] dark:hover:bg-[#1E2A47]"
        >
          <X className="w-5 h-5 text-[#5A6372] dark:text-[#9AA5BD]" />
        </button>

        {/* Logo Section */}
        <div className="p-6 border-b border-[#D8DAE6] dark:border-[#2A3656]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center relative bg-[#1E2A66]">
              <span className="text-white font-bold text-lg leading-none">M</span>
              <span className="absolute bottom-1 left-2 right-2 h-0.5 rounded-full bg-[#E63027]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1F2330] dark:text-[#ECEEF5] leading-tight">
                UniAssist
              </h1>
              <p className="text-[11px] text-[#5A6372] dark:text-[#9AA5BD]">
                MAJU Student Assistant
              </p>
            </div>
          </div>
        </div>

        {/* Guest Info */}
        <div className="p-4 border-b border-[#D8DAE6] dark:border-[#2A3656]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-linear-to-r from-[#1E2A66] to-[#E63027] flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1F2330] dark:text-[#ECEEF5]">
                Guest User
              </p>
              <p className="text-xs text-[#5A6372] dark:text-[#9AA5BD]">
                Text Chat Only
              </p>
            </div>
            {guestSessionId && (
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-md hover:bg-[#F2F3F8] dark:hover:bg-[#1E2A47]"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4 text-[#5A6372] dark:text-[#9AA5BD]" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4">
          <button
            onClick={() => navigate("/register")}
            className="w-full bg-linear-to-r from-[#1E2A66] to-[#1E2A66] hover:from-[#16204D] hover:to-[#16204D] 
            text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Register for Full Access
          </button>
        </div>

        {/* Suggested Topics */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <h3 className="text-sm font-medium text-[#1F2330] dark:text-[#ECEEF5] mb-3">
            Quick Start Topics
          </h3>

          <div className="space-y-2">
            {suggestedTopics.map((topic, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedTopic(topic.text)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  theme === "dark"
                    ? "hover:bg-[#1E2A47]"
                    : "hover:bg-[#F2F3F8]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {topic.icon}
                  <p
                    className={`text-sm font-medium ${
                      theme === "dark" ? "text-[#ECEEF5]" : "text-[#1F2330]"
                    }`}
                  >
                    {topic.text}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Theme & Auth */}
        <div className="p-4 border-t border-[#D8DAE6] dark:border-[#2A3656] space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F2F3F8] dark:bg-[#1E2A47]">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="w-4 h-4 text-[#E63027]" />
              ) : (
                <Sun className="w-4 h-4 text-[#E63027]" />
              )}
              <span className="text-sm font-medium text-[#1F2330] dark:text-[#ECEEF5]">
                Theme
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={theme === "dark"}
                onChange={toggleTheme}
                className="sr-only peer"
              />
              <div
                className={`w-10 h-5 rounded-full peer ${
                  theme === "dark" ? "bg-[#E63027]" : "bg-[#D8DAE6]"
                }`}
              ></div>
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  theme === "dark" ? "translate-x-5" : ""
                }`}
              ></div>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate("/login")}
              className="flex-1 px-3 py-2 text-sm bg-[#F2F3F8] dark:bg-[#1E2A47] text-[#1F2330] dark:text-[#ECEEF5] rounded-lg hover:bg-[#E7E8F0] dark:hover:bg-[#16203A]"
            >
              Login
            </button>
            <button
              onClick={() => navigate("/register")}
              className="flex-1 px-3 py-2 text-sm bg-linear-to-r from-[#1E2A66] to-[#1E2A66] text-white rounded-lg hover:from-[#16204D] hover:to-[#16204D]"
            >
              Register
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden md:ml-0">
        {/* Mobile Header */}
        <header
          className={`md:hidden sticky top-0 z-10 border-b ${
            theme === "dark"
              ? "bg-[#16203A]/95 border-[#2A3656] backdrop-blur-lg"
              : "bg-white/95 border-[#D8DAE6] backdrop-blur-lg"
          }`}
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsMenuOpen(true)}
                className="p-2 hover:bg-[#F2F3F8] dark:hover:bg-[#1E2A47] rounded-lg"
              >
                <svg
                  className="w-6 h-6 text-[#1F2330] dark:text-[#ECEEF5]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              <div className="flex flex-col items-center">
                <h1 className="text-lg font-bold text-[#1F2330] dark:text-[#ECEEF5]">
                  UniAssist
                </h1>
                <p className="text-xs text-[#5A6372] dark:text-[#9AA5BD]">
                  Guest Mode
                </p>
              </div>

              {guestSessionId && (
                <button
                  onClick={handleClearChat}
                  className="p-2 hover:bg-[#F2F3F8] dark:hover:bg-[#1E2A47] rounded-lg"
                  title="Clear chat"
                >
                  <Trash2 className="w-5 h-5 text-[#5A6372] dark:text-[#9AA5BD]" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Guest Limitations Banner */}
        <div
          className={`px-4 py-2 border-b ${
            theme === "dark"
              ? "bg-yellow-900/20 border-yellow-800/30"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info
                className={`w-4 h-4 ${
                  theme === "dark" ? "text-yellow-400" : "text-yellow-600"
                }`}
              />
              <p
                className={`text-xs ${
                  theme === "dark" ? "text-yellow-300" : "text-yellow-700"
                }`}
              >
                Guest Mode: Unlimited text chat • No voice/job/event features • Chat
                not saved
              </p>
            </div>
            <button
              onClick={() => navigate("/register")}
              className="cursor-pointer text-xs text-[#E63027] dark:text-[#C48A4A] hover:underline font-medium"
            >
              Upgrade →
            </button>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 flex flex-col py-4 md:py-6 max-md:py-2 overflow-hidden">
          {/* Welcome Message when no chats */}
          {displayMessages.length === 0 && (
            <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
            <div
              className={`mb-4 p-4 md:p-6 rounded-xl border ${
                theme === "dark"
                  ? "bg-linear-to-r from-[#16203A] to-[#1E2A47] border-[#2A3656]"
                  : "bg-linear-to-r from-[#E7E8F0] to-[#F2F3F8] border-[#D8DAE6]"
              }`}
            >
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center relative bg-[#1E2A66] shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                  <span className="absolute bottom-1 left-2 right-2 h-0.5 rounded-full bg-[#E63027]" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-lg font-bold text-[#1F2330] dark:text-[#ECEEF5] mb-2">
                    Welcome to UniAssist!
                  </h2>
                  <p
                    className={`text-sm ${
                      theme === "dark" ? "text-[#9AA5BD]" : "text-[#5A6372]"
                    }`}
                  >
                    I'm your MAJU assistant. Ask me anything about
                    admissions, programs, fees, deadlines, and campus
                    information.
                    <br />
                    <span className="font-medium mt-1 block">
                      Start by typing your question or selecting a topic from
                      the sidebar.
                    </span>
                  </p>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* Chat Messages Area - Fixed with proper ref */}
          <div
            ref={messagesContainerRef}
            className="flex-1 mb-3 overflow-y-auto overscroll-contain scroll-smooth"
            style={{
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
            {displayMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                } mb-3`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-3 py-2 ${
                    message.sender === "user"
                      ? "bg-[#1E2A66] text-white rounded-br-none"
                      : theme === "dark"
                      ? "bg-[#16203A] text-[#ECEEF5] rounded-bl-none border border-[#2A3656]"
                      : "bg-white text-[#1F2330] rounded-bl-none border border-[#D8DAE6] shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.sender === "bot" && (
                      <Brain className="w-4 h-4 text-[#1E2A66] dark:text-[#E63027] mt-0.5 shrink-0" />
                    )}
                    <p className="text-sm md:text-base wrap-break-words whitespace-pre-wrap">
                      {message.text}
                    </p>
                  </div>
                  <p
                    className={`text-xs mt-2 ${
                      message.sender === "user"
                        ? "text-white/70"
                        : theme === "dark"
                        ? "text-[#9AA5BD]"
                        : "text-[#5A6372]"
                    }`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    theme === "dark"
                      ? "bg-[#16203A] border border-[#2A3656]"
                      : "bg-white border border-[#D8DAE6]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-[#E63027] rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-[#E63027] rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-[#E63027] rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                    <span
                      className={`text-sm ${
                        theme === "dark" ? "text-[#9AA5BD]" : "text-[#5A6372]"
                      }`}
                    >
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Invisible element at the end for scrolling reference */}
            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
          <form
            onSubmit={handleSendMessage}
            className="p-1 rounded-xl border bg-white dark:bg-[#16203A] border-[#D8DAE6] dark:border-[#2A3656] shadow-sm"
          >
            <div className="flex gap-1.5">
              {/* Input Field */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask about MAJU…"
                  className="w-full pl-3 pr-10 py-1.5 bg-transparent outline-none text-[#1F2330] dark:text-[#ECEEF5] placeholder-[#5A6372] dark:placeholder-[#9AA5BD] text-sm rounded-lg border border-[#D8DAE6] dark:border-[#2A3656] focus:border-[#1E2A66] dark:focus:border-[#E63027] focus:ring-1 focus:ring-[#1E2A66]/20 dark:focus:ring-[#E63027]/20"
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className={`px-3 py-1.5 rounded-lg transition-all shrink-0 flex items-center justify-center ${
                  isLoading || !inputMessage.trim()
                    ? "bg-[#D8DAE6] dark:bg-[#2A3656] cursor-not-allowed"
                    : "bg-linear-to-r from-[#1E2A66] to-[#1E2A66] hover:from-[#16204D] hover:to-[#16204D]"
                }`}
              >
                <Send
                  className={`w-3.5 h-3.5 ${
                    isLoading || !inputMessage.trim()
                      ? "text-[#9AA5BD]"
                      : "text-white"
                  }`}
                />
              </button>
            </div>

            {/* Guest Info */}
            <div className="flex items-center justify-between mt-1.5 px-1">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                <span className="text-[10px] text-[#5A6372] dark:text-[#9AA5BD]">
                  Guest Mode • Unlimited Messages
                </span>
              </div>
              <div className="text-[10px] text-[#5A6372] dark:text-[#9AA5BD]">
                <button
                  onClick={() => navigate("/register")}
                  className="text-[#E63027] dark:text-[#C48A4A] hover:underline"
                >
                  Register for voice & email →
                </button>
              </div>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestChat;