import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import moment from "moment";
import {
  fetchNotifications,
  fetchUnreadCount,
  markRead,
  markAllRead,
} from "../redux/slices/notificationSlice";

// Where a notification type should open, regardless of the stored link
// (question notifications always go to the matching role's page).
const TYPE_LINKS = {
  question_answered: "/questions",
  question_new: "/admin/questions",
};

const NotificationBell = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifications, unreadCount } = useSelector((s) => s.notification);
  const user = useSelector((s) => s.auth.user);
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    dispatch(fetchUnreadCount());
    const id = setInterval(() => {
      if (document.visibilityState === "visible") dispatch(fetchUnreadCount());
    }, 20000);
    return () => clearInterval(id);
  }, [dispatch, user]);

  useEffect(() => {
    if (open) dispatch(fetchNotifications());
  }, [open, dispatch]);

  useEffect(() => {
    const onClick = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleClickItem = async (n) => {
    if (!n.isRead) await dispatch(markRead(n._id));
    setOpen(false);
    const target = TYPE_LINKS[n.type] || n.link;
    if (target) navigate(target);
  };

  const handleMarkAll = async () => {
    await dispatch(markAllRead());
    dispatch(fetchNotifications());
  };

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-control transition-colors text-label hover:bg-nav-hover focus-ring"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-primary text-on-primary"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-hidden rounded-card border bg-surface border-border text-text shadow-panel z-50 flex flex-col"
        >
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b border-border"
          >
            <span className="font-bold text-sm text-heading">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs font-semibold inline-flex items-center gap-1 text-link hover:text-link-hover rounded focus-ring"
              >
                <Check className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="text-center text-sm py-10 text-muted">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleClickItem(n)}
                  className={`w-full text-left p-3 border-b border-border transition-colors hover:bg-row-hover focus-ring ${
                    n.isRead ? "" : "bg-nav-active-bg"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-primary" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text">{n.message}</p>
                      <p className="text-xs mt-0.5 text-muted">
                        {moment(n.createdAt).fromNow()}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
