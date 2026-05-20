import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "../utils/axios";
import {
  createNewChat,
  deleteChat,
  fetchUsersChats,
  setSelectedChat,
} from "../redux/slices/chatSlice";
import { setTheme } from "../redux/slices/themeSlice";
import { logoutUser } from "../redux/slices/authSlice";
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
  Briefcase,
  AlertCircle,
  Inbox,
  LayoutDashboard,
  Users as UsersIcon,
  UserPlus,
  Building2,
  HelpCircle,
  Database,
  Activity,
} from "lucide-react";
import toast from "react-hot-toast";
import moment from "moment";
import { useNavigate, useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell";

const Sidebar = ({ isMenuOpen, setIsMenuOpen }) => {
  const dispatch = useDispatch();
  const chats = useSelector((s) => s.chat.chats);
  const selectedChat = useSelector((s) => s.chat.selectedChat);
  const theme = useSelector((s) => s.theme.theme);
  const user = useSelector((s) => s.auth.user);
  const token = useSelector((s) => s.auth.token);

  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const sidebarRef = useRef(null);
  const [loadingChatId, setLoadingChatId] = useState(null);
  const isDark = theme === "dark";

  const isStudent = user?.role === "student" || !user?.role;
  const isStaff = user?.role === "staff";
  const isAdmin = user?.role === "admin";

  // palette tokens
  const C = {
    bg: isDark ? "#0E1422" : "#FFFFFF",
    surface: isDark ? "#16203A" : "#FFFFFF",
    surfaceAlt: isDark ? "#1E2A47" : "#F2F3F8",
    input: isDark ? "#0B1120" : "#F2F3F8",
    border: isDark ? "#2A3656" : "#D8DAE6",
    text: isDark ? "#ECEEF5" : "#1F2330",
    muted: isDark ? "#9AA5BD" : "#5A6372",
    navy: isDark ? "#E63027" : "#1E2A66",
    red: isDark ? "#C48A4A" : "#E63027",
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

  const handleLogout = async () => {
    await dispatch(logoutUser());
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
        dispatch(setSelectedChat(data.chat));
        toast.success("Chat loaded successfully");
      } else {
        toast.error("Failed to load chat messages");
        dispatch(setSelectedChat(chat));
      }
    } catch (error) {
      console.error("Error loading chat:", error);
      toast.error("Failed to load chat");
      dispatch(setSelectedChat(chat));
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
      const result = await dispatch(deleteChat({ chatId })).unwrap();
      if (result.success) {
        toast.success("Chat deleted successfully");
        if (selectedChat && selectedChat._id === chatId) {
          dispatch(setSelectedChat(null));
        }
        await dispatch(fetchUsersChats());
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
      const result = await dispatch(createNewChat()).unwrap();
      if (result.success) {
        await dispatch(fetchUsersChats());
        navigate("/chat");
      } else {
        toast.error(result.message || "Failed to create new chat");
      }
    } catch {
      toast.error("Error creating new chat");
    }
  };

  const NavLink = ({ to, icon, label, accent }) => {
    const active = location.pathname === to || location.pathname.startsWith(to + "/");
    return (
      <Link
        to={to}
        className="w-full flex items-center gap-3 p-2 rounded-lg transition-all text-sm"
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
        className={`flex flex-col h-screen w-64 z-50 border-r transition-all duration-300 fixed md:relative
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
        <Link to={isStaff ? "/staff/dashboard" : isAdmin ? "/admin/dashboard" : "/chat"}>
          <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: C.border }}>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center relative"
              style={{ backgroundColor: C.navy }}
            >
              <span className="text-white font-bold text-lg leading-none">M</span>
              <span
                className="absolute bottom-1 left-2 right-2 h-0.5 rounded-full"
                style={{ backgroundColor: C.red }}
              />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight" style={{ color: C.text }}>
                UniAssist
              </h1>
              <p className="text-[11px]" style={{ color: C.muted }}>
                MAJU Student Assistant
              </p>
            </div>
          </div>
        </Link>

        {/* User Profile + Bell — clicking the profile area goes to /profile */}
        <div className="p-3 border-b flex items-center gap-3" style={{ borderColor: C.border }}>
          <Link
            to="/profile"
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90 transition"
            title="Manage your profile"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: C.navy }}
            >
              {user?.profilePicture ? (
                <img
                  src={`${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}${user.profilePicture}`}
                  alt={user.name || "avatar"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-semibold text-sm">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: C.text }}>
                {user?.name || "User"}
              </p>
              <p className="text-xs truncate" style={{ color: C.muted }}>
                {isStaff ? (user?.staffTitle || "Staff") : isAdmin ? "Administrator" : (user?.email || "student@maju.edu.pk")}
              </p>
            </div>
          </Link>
          <NotificationBell />
        </div>

        {/* Student-only: New Chat */}
        {isStudent && (
          <div className="p-3">
            <button
              onClick={handleNewChat}
              className="w-full text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all text-sm cursor-pointer"
              style={{ backgroundColor: C.navy }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? "#C81E15" : "#16204D")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = C.navy)}
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          </div>
        )}

        {/* Student-only: Search Chats */}
        {isStudent && (
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
        )}

        {/* Recent Chats (student only) */}
        {isStudent && (
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
        )}

        {/* Admin nav (top, scrollable) */}
        {isAdmin && (
          <div className="flex-1 overflow-y-auto px-2 pt-3 pb-2 space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide px-2 mb-2" style={{ color: C.muted }}>
              Admin Console
            </h3>
            <NavLink
              to="/admin/dashboard"
              icon={<LayoutDashboard className="w-4 h-4" />}
              label="Dashboard"
              accent={C.navy}
            />
            <NavLink
              to="/admin/users"
              icon={<UsersIcon className="w-4 h-4" />}
              label="Users"
              accent={C.navy}
            />
            <NavLink
              to="/admin/staff"
              icon={<UserPlus className="w-4 h-4" />}
              label="Staff"
              accent={C.red}
            />
            <NavLink
              to="/admin/departments"
              icon={<Building2 className="w-4 h-4" />}
              label="Departments"
              accent={C.navy}
            />
            <NavLink
              to="/admin/query"
              icon={<HelpCircle className="w-4 h-4" />}
              label="Query"
              accent={C.red}
            />
            <NavLink
              to="/admin/data"
              icon={<Database className="w-4 h-4" />}
              label="Data"
              accent={C.navy}
            />
            <NavLink
              to="/admin/logs"
              icon={<Activity className="w-4 h-4" />}
              label="Logs & Activity"
              accent={C.red}
            />
          </div>
        )}

        {/* Staff filler section */}
        {!isStudent && !isAdmin && <div className="flex-1" />}

        {/* Quick Actions / Nav */}
        <div className="p-1.5 border-t space-y-1" style={{ borderColor: C.border }}>
          {isStudent && (
            <>
              <NavLink
                to="/issues"
                icon={<AlertCircle className="w-4 h-4" />}
                label="My Issues"
                accent={C.red}
              />
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
            </>
          )}
          {isStaff && (
            <>
              <NavLink
                to="/staff/dashboard"
                icon={<LayoutDashboard className="w-4 h-4" />}
                label="Dashboard"
                accent={C.navy}
              />
              <NavLink
                to="/staff/issues"
                icon={<Inbox className="w-4 h-4" />}
                label="Department Inbox"
                accent={C.red}
              />
            </>
          )}
        </div>

        <div className="p-1.5 border-t" style={{ borderColor: C.border }}>
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
                onChange={() => dispatch(setTheme(isDark ? "light" : "dark"))}
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
