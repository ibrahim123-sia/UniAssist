import React, { useState, useEffect, useRef } from "react";
import { useAppContext } from "../context/AppContext";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Mail,
  Calendar,
  User,
  LogOut,
  X,
  Moon,
  Sun,
  CreditCard,
  GraduationCap,
  Settings,
  Bell,
} from "lucide-react";
import toast from "react-hot-toast";
import moment from "moment";
import { useNavigate, useLocation } from "react-router-dom";

const Sidebar = ({ isMenuOpen, setIsMenuOpen }) => {
  const {
    chats,
    setSelectedChat,
    selectedChat,
    theme,
    setTheme,
    user,
    createNewChat,
    deleteChat, // Use the actual deleteChat from context
    token,
  } = useAppContext();

  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const sidebarRef = useRef(null);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMenuOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        window.innerWidth < 768 // Only on mobile
      ) {
        setIsMenuOpen(false);
      }
    };

    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);

    // Remove event listener on cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen, setIsMenuOpen]);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMenuOpen && window.innerWidth < 768) {
      setIsMenuOpen(false);
    }
  }, [location.pathname, setIsMenuOpen]);

  // Close sidebar on escape key press
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === "Escape" && isMenuOpen && window.innerWidth < 768) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isMenuOpen, setIsMenuOpen]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const handleChatClick = (chat) => {
    setSelectedChat(chat);
    if (window.innerWidth < 768) {
      setIsMenuOpen(false);
    }
  };

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    const confirm = window.confirm(
      "Are you sure you want to delete this chat?"
    );

    if (!confirm) return;

    try {
      // Call the actual deleteChat function from context (which calls the API)
      const result = await deleteChat(chatId);
      
      if (result.success) {
        toast.success("Chat deleted successfully");
        
        // Clear selected chat if it was the deleted one
        if (selectedChat && selectedChat._id === chatId) {
          setSelectedChat(null);
        }
        
        // Close sidebar on mobile after deletion
        if (window.innerWidth < 768) {
          setIsMenuOpen(false);
        }
      } else {
        toast.error(result.message || "Failed to delete chat");
      }
    } catch (error) {
      toast.error(error.message || "Failed to delete chat");
    }
  };

  const handleNewChat = async () => {
    const result = await createNewChat();
    if (result.success) {
      navigate("/chat");
    }
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (window.innerWidth < 768) {
      setIsMenuOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Overlay - Click outside to close */}
      {isMenuOpen && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`flex flex-col h-screen w-72 z-50 ${
          theme === "dark"
            ? "bg-gray-900/95 border-gray-700 backdrop-blur-lg"
            : "bg-white/95 border-gray-200 backdrop-blur-lg"
        } border-r transition-all duration-300 fixed md:relative
        ${isMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Close button for mobile */}
        <button
          onClick={() => setIsMenuOpen(false)}
          className="md:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Logo Section */}
        <Link to="/chat">
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
        </Link>

        {/* User Profile */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-linear-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user?.name?.charAt(0) || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {user?.email || "student@maju.edu.pk"}
              </p>
            </div>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-2">
          <button
            onClick={handleNewChat}
            className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 
            text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>

        {/* Search Chats */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border ${
                theme === "dark"
                  ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                  : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
        </div>

        {/* Recent Chats */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Recent Conversations
          </h3>

          <div className="space-y-2">
            {chats
              .filter(
                (chat) =>
                  chat.messages?.[0]?.content
                    ?.toLowerCase()
                    .includes(search.toLowerCase()) ||
                  chat.name?.toLowerCase().includes(search.toLowerCase())
              )
              .map((chat) => (
                <div
                  key={chat._id || chat.id}
                  onClick={() => handleChatClick(chat)}
                  className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                    theme === "dark"
                      ? "hover:bg-gray-800/50"
                      : "hover:bg-gray-100"
                  } ${selectedChat?._id === chat._id ? 
                    (theme === "dark" ? "bg-gray-800" : "bg-blue-50 border border-blue-200") : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <p
                        className={`text-sm font-medium truncate ${
                          theme === "dark" ? "text-gray-200" : "text-gray-800"
                        }`}
                      >
                        {chat.messages?.[0]?.content?.slice(0, 30) ||
                          chat.name ||
                          "New Chat"}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {chat.updatedAt
                        ? moment(chat.updatedAt).fromNow()
                        : "Just now"}
                    </p>
                  </div>

                  <button
                    onClick={(e) => handleDeleteChat(e, chat._id || chat.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-opacity"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-500" />
                  </button>
                </div>
              ))}

            {chats.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No conversations yet
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Start a new chat to get started
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <Link
            to="/jobs"
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-gray-700 dark:text-gray-300 
            hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-sm ${
              location.pathname === "/chat"
                ? theme === "dark"
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-900"
                : ""
            }`}
          >
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span>Job Opportunities</span>
          </Link>

          <Link
            to="events"
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-gray-700 dark:text-gray-300 
            hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-sm ${
              location.pathname === "/deadlines"
                ? theme === "dark"
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-900"
                : ""
            }`}
          >
            <Calendar className="w-4 h-4 text-green-500" />
            <span>University Events</span>
          </Link>

          <Link
            to="/credits"
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-gray-700 dark:text-gray-300 
            hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-sm ${
              location.pathname === "/credits"
                ? theme === "dark"
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-900"
                : ""
            }`}
          >
            <CreditCard className="w-4 h-4 text-yellow-500" />
            <span>Buy Credits</span>
            <span className="ml-auto text-sm font-bold text-blue-600 dark:text-blue-400">
              {user?.credits || 0}
            </span>
          </Link>
        </div>

        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between rounded-lg bg-gray-100/50 dark:bg-gray-800/50">
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
                onChange={() => setTheme(theme === "dark" ? "light" : "dark")}
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

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-1 text-gray-700 dark:text-gray-300 
            hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;