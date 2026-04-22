import React, { useState, useEffect, useRef } from "react";
import { useAppContext } from "../context/AppContext";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Calendar,
  LogOut,
  X,
  Moon,
  Sun,
  GraduationCap,
  Briefcase,
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
    deleteChat,
    token,
    fetchUsersChats,
    axios,
  } = useAppContext();

  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const sidebarRef = useRef(null);
  const [loadingChatId, setLoadingChatId] = useState(null);
  const isDark = theme === "dark";

  // palette tokens
  const C = {
    bg: isDark ? "#0F1626" : "#FFFFFF",
    surface: isDark ? "#17203A" : "#FFFFFF",
    surfaceAlt: isDark ? "#1E2A47" : "#F5F6F8",
    input: isDark ? "#121A2E" : "#F5F6F8",
    border: isDark ? "#273350" : "#E2E5EA",
    text: isDark ? "#ECEEF3" : "#222222",
    muted: isDark ? "#A9B2C7" : "#5A6372",
    navy: isDark ? "#6E8BE0" : "#1E2E6E",
    red: isDark ? "#E57A63" : "#D0321E",
  };

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMenuOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        window.innerWidth < 768
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen, setIsMenuOpen]);

  useEffect(() => {
    if (isMenuOpen && window.innerWidth < 768) {
      setIsMenuOpen(false);
    }
  }, [location.pathname, setIsMenuOpen]);

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

  const handleChatClick = async (chat) => {
    try {
      setLoadingChatId(chat._id || chat.id);
      navigate("/chat");

      const { data } = await axios.get(`/api/chat/${chat._id || chat.id}`, {
        headers: { Authorization: token },
      });

      if (data.success) {
        setSelectedChat(data.chat);
        toast.success("Chat loaded successfully");
      } else {
        toast.error("Failed to load chat messages");
        setSelectedChat(chat);
      }
    } catch (error) {
      console.error("Error loading chat:", error);
      toast.error("Failed to load chat");
      setSelectedChat(chat);
    } finally {
      setLoadingChatId(null);
      if (window.innerWidth < 768) {
        setIsMenuOpen(false);
      }
    }
  };

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    const confirm = window.confirm(
      "Are you sure you want to delete this chat?"
    );
    if (!confirm) return;

    try {
      const result = await deleteChat(chatId);
      if (result.success) {
        toast.success("Chat deleted successfully");
        if (selectedChat && selectedChat._id === chatId) {
          setSelectedChat(null);
        }
        await fetchUsersChats();
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
    try {
      const result = await createNewChat();
      if (result.success) {
        await fetchUsersChats();
        navigate("/chat");
      } else {
        toast.error(result.message || "Failed to create new chat");
      }
    } catch {
      toast.error("Error creating new chat");
    }
  };

  const NavLink = ({ to, icon, label, accent }) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className="w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-sm"
        style={{
          color: C.text,
          backgroundColor: active ? C.surfaceAlt : "transparent",
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.backgroundColor = C.surfaceAlt;
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <span style={{ color: accent }}>{icon}</span>
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMenuOpen && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 z-40 transition-opacity duration-300"
          style={{ backgroundColor: "rgba(15, 22, 38, 0.6)" }}
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`flex flex-col h-screen w-72 z-50 border-r transition-all duration-300 fixed md:relative
        ${isMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        style={{
          backgroundColor: C.surface,
          borderColor: C.border,
          color: C.text,
        }}
      >
        {/* Close button for mobile */}
        <button
          onClick={() => setIsMenuOpen(false)}
          className="md:hidden absolute top-4 right-4 p-2 rounded-lg transition-colors"
          style={{ color: C.muted }}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo Section */}
        <Link to="/chat">
          <div className="p-6 border-b flex items-center gap-3" style={{ borderColor: C.border }}>
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center relative"
              style={{ backgroundColor: C.navy }}
            >
              <GraduationCap className="w-6 h-6 text-white" />
              <span
                className="absolute -bottom-1 left-2 right-2 h-0.5 rounded-full"
                style={{ backgroundColor: C.red }}
              />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: C.text }}>
                UniAssist
                <span style={{ color: C.red }}>.ai</span>
              </h1>
              <p className="text-xs" style={{ color: C.muted }}>
                MAJU University Assistant
              </p>
            </div>
          </div>
        </Link>

        {/* User Profile */}
        <div className="p-3 border-b flex items-center gap-3" style={{ borderColor: C.border }}>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: C.navy }}
          >
            <span className="text-white font-semibold text-sm">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: C.text }}>
              {user?.name || "User"}
            </p>
            <p className="text-xs truncate" style={{ color: C.muted }}>
              {user?.email || "student@maju.edu.pk"}
            </p>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all text-sm cursor-pointer"
            style={{ backgroundColor: C.navy }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? "#8AA3E8" : "#162356")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = C.navy)}
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>

        {/* Search Chats */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
              style={{ color: C.muted }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border focus:outline-none"
              style={{
                backgroundColor: C.input,
                borderColor: C.border,
                color: C.text,
              }}
            />
          </div>
        </div>

        {/* Recent Chats */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.muted }}>
            Recent Conversations
          </h3>

          <div className="space-y-1.5">
            {chats
              .filter(
                (chat) =>
                  chat.messages?.[0]?.content
                    ?.toLowerCase()
                    .includes(search.toLowerCase()) ||
                  chat.name?.toLowerCase().includes(search.toLowerCase())
              )
              .map((chat) => {
                const isSelected = selectedChat?._id === chat._id;
                const isLoading = loadingChatId === chat._id;

                return (
                  <div
                    key={chat._id || chat.id}
                    onClick={() => handleChatClick(chat)}
                    className="group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all"
                    style={{
                      backgroundColor: isSelected ? C.surfaceAlt : "transparent",
                      border: isSelected ? `1px solid ${C.border}` : "1px solid transparent",
                      opacity: isLoading ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = C.surfaceAlt;
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
                        <p className="text-sm font-medium truncate" style={{ color: C.text }}>
                          {chat.messages?.[0]?.content?.slice(0, 30) ||
                            chat.name ||
                            "New Chat"}
                        </p>
                        {isLoading && (
                          <div
                            className="ml-2 w-3 h-3 border-2 rounded-full animate-spin shrink-0"
                            style={{ borderColor: C.border, borderTopColor: C.navy }}
                          ></div>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: C.muted }}>
                        {chat.updatedAt
                          ? moment(chat.updatedAt).fromNow()
                          : "Just now"}
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDeleteChat(e, chat._id || chat.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                      aria-label="Delete chat"
                      disabled={isLoading}
                      style={{ color: C.muted }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = C.red)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

            {chats.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 mx-auto mb-3" style={{ color: C.border }} />
                <p className="text-sm" style={{ color: C.muted }}>
                  No conversations yet
                </p>
                <p className="text-xs mt-1" style={{ color: C.muted, opacity: 0.7 }}>
                  Start a new chat to get started
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-2 border-t space-y-1" style={{ borderColor: C.border }}>
          <NavLink
            to="/jobs"
            icon={<Briefcase className="w-4 h-4" />}
            label="Job Opportunities"
            accent={C.navy}
          />
          <NavLink
            to="/events"
            icon={<Calendar className="w-4 h-4" />}
            label="University Events"
            accent={C.red}
          />
        </div>

        <div className="p-3 border-t" style={{ borderColor: C.border }}>
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2 mb-2"
            style={{ backgroundColor: C.surfaceAlt }}
          >
            <div className="flex items-center gap-3">
              {isDark ? (
                <Moon className="w-4 h-4" style={{ color: C.navy }} />
              ) : (
                <Sun className="w-4 h-4" style={{ color: C.red }} />
              )}
              <span className="text-sm font-medium" style={{ color: C.text }}>
                Theme
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isDark}
                onChange={() => setTheme(isDark ? "light" : "dark")}
                className="sr-only peer"
              />
              <div
                className="w-10 h-5 rounded-full transition-colors"
                style={{ backgroundColor: isDark ? C.navy : C.border }}
              ></div>
              <div
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: isDark ? "translateX(20px)" : "translateX(0)" }}
              ></div>
            </label>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg transition-all text-sm"
            style={{ color: C.text }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.surfaceAlt)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
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
