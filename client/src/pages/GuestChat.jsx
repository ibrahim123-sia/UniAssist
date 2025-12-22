import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  Send,
  Brain,
  GraduationCap,
  Sun,
  Moon,
  Mail,
  Calendar,
  Book,
  Info,
  Sparkles,
  Users,
  Building,
  CreditCard,
  X,
  RotateCcw,
  Trash2,
  MessageCircle,
} from "lucide-react";
import toast from "react-hot-toast";

const GuestChat = () => {
  const {
    theme,
    setTheme,
    sendGuestMessage,
    guestMessages,
    guestSessionId,
    clearGuestSession,
    startNewGuestSession,
  } = useAppContext();

  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Update the scrollToBottom function:
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [guestMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);
    scrollToBottom();

    try {
      const result = await sendGuestMessage(userMessage);
       scrollToBottom();

      if (!result.success) {
        toast.error(result.message || "Failed to send message");
      }
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
    clearGuestSession();
    toast.success("Chat cleared. Start a new conversation.");
  };

  const suggestedTopics = [
    {
      icon: <Book className="w-4 h-4" />,
      text: "What programs does MAJU offer?",
    },
    { icon: <Users className="w-4 h-4" />, text: "Admission requirements?" },
    { icon: <Calendar className="w-4 h-4" />, text: "Application deadlines?" },
    { icon: <CreditCard className="w-4 h-4" />, text: "Fee structure?" },
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
          ? "bg-gray-900"
          : "bg-linear-to-b from-blue-50 via-white to-gray-50"
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
        className={`flex flex-col h-screen w-72 ${
          theme === "dark"
            ? "bg-gray-900/95 border-gray-700 backdrop-blur-lg"
            : "bg-white/95 border-gray-200 backdrop-blur-lg"
        } border-r transition-transform duration-300 fixed md:relative z-40
      ${isMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Close button for mobile */}
        <button
          onClick={() => setIsMenuOpen(false)}
          className="md:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Logo Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-r from-blue-600 to-indigo-600 rounded-lg">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                UniAssist
                <span className="text-blue-600 dark:text-blue-400">.ai</span>
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                MAJU University Assistant
              </p>
            </div>
          </div>
        </div>

        {/* Guest Info */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-linear-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Guest User
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Text Chat Only
              </p>
            </div>
            {guestSessionId && (
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4">
          <button
            onClick={() => navigate("/register")}
            className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
            text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Register for Full Access
          </button>
        </div>

        {/* Suggested Topics */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Quick Start Topics
          </h3>

          <div className="space-y-2">
            {suggestedTopics.map((topic, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedTopic(topic.text)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  theme === "dark"
                    ? "hover:bg-gray-800/50"
                    : "hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {topic.icon}
                  <p
                    className={`text-sm font-medium ${
                      theme === "dark" ? "text-gray-200" : "text-gray-800"
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
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-100/50 dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="w-4 h-4 text-purple-400" />
              ) : (
                <Sun className="w-4 h-4 text-yellow-500" />
              )}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                  theme === "dark" ? "bg-purple-600" : "bg-gray-300"
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
              className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Login
            </button>
            <button
              onClick={() => navigate("/register")}
              className="flex-1 px-3 py-2 text-sm bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700"
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
              ? "bg-gray-900/95 border-gray-700 backdrop-blur-lg"
              : "bg-white/95 border-gray-200 backdrop-blur-lg"
          }`}
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsMenuOpen(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <svg
                  className="w-6 h-6 text-gray-700 dark:text-gray-300"
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
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  UniAssist
                  <span className="text-blue-600 dark:text-blue-400">.ai</span>
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Guest Mode
                </p>
              </div>

              {guestSessionId && (
                <button
                  onClick={handleClearChat}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="Clear chat"
                >
                  <Trash2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
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
                Guest Mode: Unlimited text chat • No voice/email features • Chat
                not saved
              </p>
            </div>
            <button
              onClick={() => navigate("/register")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Upgrade →
            </button>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 flex flex-col p-4 md:p-6 xl:px-30 max-md:p-2 overflow-hidden">
          {/* Welcome Message when no chats */}
          {displayMessages.length === 0 && (
            <div
              className={`mb-4 p-4 md:p-6 rounded-xl ${
                theme === "dark"
                  ? "bg-linear-to-r from-gray-800 to-gray-900 border border-gray-700"
                  : "bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100"
              }`}
            >
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="p-3 bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Welcome to UniAssist!
                  </h2>
                  <p
                    className={`text-sm ${
                      theme === "dark" ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    I'm your MAJU University assistant. Ask me anything about
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
          )}

          {/* Chat Messages Area */}
          <div
            ref={messagesEndRef}
            className="flex-1 mb-3 overflow-y-auto overscroll-contain scroll-smooth"
            style={{
              WebkitOverflowScrolling: "touch",
            }}
          >
            {displayMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                } mb-3`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.sender === "user"
                      ? theme === "dark"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-blue-600 text-white rounded-br-none"
                      : theme === "dark"
                      ? "bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700"
                      : "bg-white text-gray-800 rounded-bl-none border border-gray-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.sender === "bot" && (
                      <Brain className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    )}
                    <p className="text-sm md:text-base wrap-break-words whitespace-pre-wrap">
                      {message.text}
                    </p>
                  </div>
                  <p
                    className={`text-xs mt-2 ${
                      message.sender === "user"
                        ? "text-blue-200"
                        : theme === "dark"
                        ? "text-gray-400"
                        : "text-gray-500"
                    }`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div ref={messagesEndRef} />
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    theme === "dark"
                      ? "bg-gray-800 border border-gray-700"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                    <span
                      className={`text-sm ${
                        theme === "dark" ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleSendMessage}
            className="p-2 rounded-xl border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 shadow-sm"
          >
            <div className="flex gap-1.5">
              {/* Input Field */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask about MAJU university..."
                  className="w-full pl-3 pr-10 py-1.5 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm rounded-lg border border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
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
                    ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                    : "bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                }`}
              >
                <Send
                  className={`w-3.5 h-3.5 ${
                    isLoading || !inputMessage.trim()
                      ? "text-gray-500"
                      : "text-white"
                  }`}
                />
              </button>
            </div>

            {/* Guest Info */}
            <div className="flex items-center justify-between mt-1.5 px-1">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Guest Mode • Unlimited Messages
                </span>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                <button
                  onClick={() => navigate("/register")}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Register for voice & email →
                </button>
              </div>
            </div>
          </form>

          {/* Guest Instructions */}
          <div className="mt-2">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
              <span className="flex items-center justify-center gap-1">
                <Info className="w-2.5 h-2.5" />
                Guest access: Text chat only • Unlimited messages • No chat
                history saved
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestChat;
