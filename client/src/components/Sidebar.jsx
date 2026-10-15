import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "../utils/axios";
import {
  createNewChat,
  deleteChat,
  renameChat,
  setSelectedChat,
  MAX_CHAT_NAME,
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
  GraduationCap,
  MessageCircleQuestion,
  HeartPulse,
  Pencil,
  Settings as SettingsIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import moment from "moment";
import { useNavigate, useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import ConfirmDialog from "../administrator/components/ConfirmDialog";
import BrandMark from "./BrandMark";

// Sidebar title: the server auto-names a chat after its first question (or
// the student renamed it); fall back to the first message for old chats.
const chatTitle = (chat) =>
  (chat.name && chat.name !== "New Chat" ? chat.name : chat.messages?.[0]?.content?.slice(0, 30)) ||
  chat.name ||
  "New Chat";

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
  const creatingChat = useSelector((s) => s.chat.creatingChat);
  // Only the most recent chat click may apply its response, so a slow
  // earlier one can't switch the view back to another chat.
  const openSeqRef = useRef(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // Inline rename: { id, value, original } while editing a chat title.
  const [renaming, setRenaming] = useState(null);
  const isDark = theme === "dark";

  const isStudent = user?.role === "student" || !user?.role;
  const isStaff = user?.role === "staff";
  const isAdmin = user?.role === "admin";

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

  // Close the mobile drawer on navigation (a no-op when it's already closed).
  useEffect(() => {
    if (window.innerWidth < 768) {
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
    const id = chat._id || chat.id;
    const seq = ++openSeqRef.current;
    try {
      setLoadingChatId(id);
      navigate("/chat");

      const { data } = await axios.get(`/api/chat/${id}`, {
        headers: { Authorization: token },
      });
      if (seq !== openSeqRef.current) return;

      if (data.success) {
        dispatch(setSelectedChat(data.chat));
      } else {
        toast.error("Failed to load chat messages");
        dispatch(setSelectedChat(chat));
      }
    } catch (error) {
      if (seq !== openSeqRef.current) return;
      console.error("Error loading chat:", error);
      toast.error("Failed to load chat");
      dispatch(setSelectedChat(chat));
    } finally {
      if (seq === openSeqRef.current) {
        setLoadingChatId(null);
        if (window.innerWidth < 768) {
          setIsMenuOpen(false);
        }
      }
    }
  };

  const handleDeleteChat = async () => {
    const chatId = confirmDeleteId;
    if (!chatId) return;
    setDeleting(true);
    try {
      const result = await dispatch(deleteChat({ chatId })).unwrap();
      if (result.success) {
        // deleteChat already refetched the list, which re-selects a
        // surviving chat if the deleted one was open.
        toast.success("Chat deleted");
        setConfirmDeleteId(null);
      } else {
        toast.error(result.message || "Failed to delete chat");
      }
    } catch (error) {
      toast.error(error.message || "Failed to delete chat");
    } finally {
      setDeleting(false);
    }
  };

  const handleNewChat = async () => {
    if (creatingChat) return;
    const action = await dispatch(createNewChat());
    // Skipped by the thunk's guard: a create is already in flight.
    if (action.meta?.condition) return;
    const result = action.payload;
    if (result?.success) {
      navigate("/chat");
    } else {
      toast.error(result?.message || "Failed to create new chat");
    }
  };

  const startRename = (e, chat) => {
    e.stopPropagation();
    const title = chatTitle(chat);
    setRenaming({ id: chat._id, value: title, original: title });
  };

  const commitRename = async () => {
    if (!renaming) return;
    const { id, value, original } = renaming;
    setRenaming(null);
    const name = value.trim().slice(0, MAX_CHAT_NAME);
    if (!name || name === original) return;
    const result = await dispatch(renameChat({ chatId: id, name })).unwrap();
    if (!result.success) toast.error(result.message || "Failed to rename chat");
  };

  const NavLink = ({ to, icon, label }) => {
    const active = location.pathname === to || location.pathname.startsWith(to + "/");
    return (
      <Link
        to={to}
        aria-current={active ? "page" : undefined}
        className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-control transition-colors text-sm focus-ring ${
          active
            ? "bg-nav-active-bg text-nav-active-text font-semibold"
            : "text-text font-medium hover:bg-nav-hover"
        }`}
      >
        <span className={active ? "text-nav-active-text" : "text-label"}>{icon}</span>
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMenuOpen && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 z-40 transition-opacity duration-300 bg-overlay"
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`flex flex-col h-screen w-64 z-50 border-r transition-all duration-300 fixed md:relative bg-sidebar-bg border-sidebar-border text-text
        ${isMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Close button for mobile */}
        <button
          onClick={() => setIsMenuOpen(false)}
          className="md:hidden absolute top-4 right-4 p-2 rounded-control transition-colors text-label hover:bg-nav-hover focus-ring"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo Section */}
        <Link to={isStaff ? "/staff/dashboard" : isAdmin ? "/admin/dashboard" : "/chat"}>
          <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
            <BrandMark />
            <div>
              <h1 className="text-[19px] font-extrabold leading-tight text-heading">
                UniAssist
              </h1>
              <p className="text-[11px] text-muted">
                MAJU Student Assistant
              </p>
            </div>
          </div>
        </Link>

        {/* User Profile + Bell — clicking the profile area goes to /profile */}
        <div className="p-3 border-b border-sidebar-border flex items-center gap-3">
          <Link
            to="/profile"
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90 transition rounded-control focus-ring"
            title="Manage your profile"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden bg-primary"
            >
              {user?.profilePicture ? (
                <img
                  src={`${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}${user.profilePicture}`}
                  alt={user.name || "avatar"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-on-primary font-semibold text-sm">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-heading">
                {user?.name || "User"}
              </p>
              <p className="text-xs truncate text-muted">
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
              disabled={creatingChat}
              aria-busy={creatingChat}
              className="w-full bg-primary hover:bg-primary-hover text-on-primary font-bold py-2.5 rounded-control flex items-center justify-center gap-2 transition-colors text-sm cursor-pointer focus-ring disabled:bg-disabled-bg disabled:text-disabled-text disabled:cursor-wait"
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-label" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-control border bg-input-bg border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
              />
            </div>
          </div>
        )}

        {/* Recent Chats (student only) */}
        {isStudent && (
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-3 text-muted">
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
                      className={`group flex items-center justify-between p-3 rounded-control cursor-pointer transition-colors border border-transparent ${
                        isSelected ? "bg-nav-active-bg" : "hover:bg-nav-hover"
                      }`}
                      style={{ opacity: isLoading ? 0.5 : 1 }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare
                            className={`w-4 h-4 shrink-0 ${isSelected ? "text-nav-active-text" : "text-label"}`}
                          />
                          {renaming?.id === chat._id ? (
                            <input
                              autoFocus
                              value={renaming.value}
                              maxLength={MAX_CHAT_NAME}
                              aria-label="Chat name"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setRenaming((r) => r && { ...r, value: e.target.value })}
                              onBlur={commitRename}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") e.currentTarget.blur();
                                else if (e.key === "Escape") setRenaming(null);
                              }}
                              className="flex-1 min-w-0 text-sm px-1 py-0.5 rounded border bg-input-bg border-input-border text-text focus:border-primary focus:outline-none"
                            />
                          ) : (
                            <p
                              className={`text-sm font-medium truncate ${isSelected ? "text-nav-active-text" : "text-text"}`}
                            >
                              {chatTitle(chat)}
                            </p>
                          )}
                          {isLoading && (
                            <div
                              className="ml-2 w-3 h-3 border-2 rounded-full animate-spin shrink-0 border-border border-t-primary"
                            ></div>
                          )}
                        </div>
                        <p className="text-xs text-muted">
                          {chat.updatedAt
                            ? moment(chat.updatedAt).fromNow()
                            : "Just now"}
                        </p>
                      </div>

                      {renaming?.id !== chat._id && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => startRename(e, chat)}
                            className="p-1 rounded text-muted hover:text-text focus-ring"
                            aria-label="Rename chat"
                            title="Rename"
                            disabled={isLoading}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(chat._id || chat.id);
                            }}
                            className="p-1 rounded text-muted hover:text-danger focus-ring"
                            aria-label="Delete chat"
                            title="Delete"
                            disabled={isLoading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

              {chats.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 text-border-strong" />
                  <p className="text-sm text-muted">
                    No conversations yet
                  </p>
                  <p className="text-xs mt-1 text-muted">
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
            <h3 className="text-xs font-semibold uppercase tracking-wide px-2 mb-2 text-muted">
              Admin Console
            </h3>
            <NavLink
              to="/admin/dashboard"
              icon={<LayoutDashboard className="w-4 h-4" />}
              label="Dashboard"
            />
            <NavLink
              to="/admin/users"
              icon={<UsersIcon className="w-4 h-4" />}
              label="Users"
            />
            <NavLink
              to="/admin/staff"
              icon={<UserPlus className="w-4 h-4" />}
              label="Staff"
            />
            <NavLink
              to="/admin/departments"
              icon={<Building2 className="w-4 h-4" />}
              label="Departments"
            />
            <NavLink
              to="/admin/query"
              icon={<HelpCircle className="w-4 h-4" />}
              label="Query"
            />
            <NavLink
              to="/admin/questions"
              icon={<MessageCircleQuestion className="w-4 h-4" />}
              label="Questions"
            />
            <NavLink
              to="/admin/listings"
              icon={<Briefcase className="w-4 h-4" />}
              label="Listings"
            />
            <NavLink
              to="/admin/data"
              icon={<Database className="w-4 h-4" />}
              label="Data"
            />
            <NavLink
              to="/admin/logs"
              icon={<Activity className="w-4 h-4" />}
              label="Logs & Activity"
            />
            <NavLink
              to="/admin/health"
              icon={<HeartPulse className="w-4 h-4" />}
              label="System Health"
            />
            <NavLink
              to="/admin/settings"
              icon={<SettingsIcon className="w-4 h-4" />}
              label="Settings"
            />
          </div>
        )}

        {/* Staff filler section */}
        {!isStudent && !isAdmin && <div className="flex-1" />}

        {/* Quick Actions / Nav */}
        <div className="p-1.5 border-t border-sidebar-border space-y-1">
          {isStudent && (
            <>
              <NavLink
                to="/issues"
                icon={<AlertCircle className="w-4 h-4" />}
                label="My Issues"
              />
              <NavLink
                to="/questions"
                icon={<MessageCircleQuestion className="w-4 h-4" />}
                label="My Questions"
              />
              <NavLink
                to="/jobs"
                icon={<Briefcase className="w-4 h-4" />}
                label="Jobs"
              />
              <NavLink
                to="/scholarships"
                icon={<GraduationCap className="w-4 h-4" />}
                label="Scholarships"
              />
              <NavLink
                to="/events"
                icon={<Calendar className="w-4 h-4" />}
                label="Events"
              />
            </>
          )}
          {isStaff && (
            <>
              <NavLink
                to="/staff/dashboard"
                icon={<LayoutDashboard className="w-4 h-4" />}
                label="Dashboard"
              />
              <NavLink
                to="/staff/issues"
                icon={<Inbox className="w-4 h-4" />}
                label="Department Inbox"
              />
            </>
          )}
        </div>

        <div className="p-1.5 border-t border-sidebar-border">
          <div className="flex items-center justify-between rounded-control px-3 py-2 mb-2 bg-nav-hover">
            <div className="flex items-center gap-3 text-label">
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span className="text-sm font-medium text-text">
                Theme
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isDark}
                onChange={() => dispatch(setTheme(isDark ? "light" : "dark"))}
                aria-label="Dark mode"
                className="sr-only peer"
              />
              <div
                className={`w-10 h-5 rounded-full transition-colors peer-focus-visible:shadow-[var(--focus-ring)] ${
                  isDark ? "bg-primary" : "bg-border-strong"
                }`}
              ></div>
              <div
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-surface transition-transform"
                style={{ transform: isDark ? "translateX(20px)" : "translateX(0)" }}
              ></div>
            </label>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-control transition-colors text-sm text-label hover:bg-nav-hover hover:text-danger focus-ring"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => !deleting && setConfirmDeleteId(null)}
        onConfirm={handleDeleteChat}
        title="Delete chat?"
        message="This conversation and its messages will be permanently deleted."
        confirmLabel="Delete"
        destructive
        loading={deleting}
      />
    </>
  );
};

export default Sidebar;
