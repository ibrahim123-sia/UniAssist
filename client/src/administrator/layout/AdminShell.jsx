import React from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { getPalette } from "../utils/palette";

const TITLES = {
  "/admin/dashboard": { title: "Dashboard", subtitle: "Overview of the entire portal" },
  "/admin/users": { title: "Users", subtitle: "Manage student accounts" },
  "/admin/staff": { title: "Staff", subtitle: "Create and manage department staff" },
  "/admin/departments": { title: "Departments", subtitle: "Manage university departments" },
  "/admin/query": { title: "Query", subtitle: "Cross-department issue analytics" },
  "/admin/data": { title: "Data", subtitle: "Manage chatbot knowledge base" },
  "/admin/logs": { title: "Logs & Activity", subtitle: "Audit, login, and chat activity" },
};

const AdminShell = () => {
  const theme = useSelector((s) => s.theme.theme);
  const C = getPalette(theme === "dark");
  const location = useLocation();

  const matchKey = Object.keys(TITLES).find((k) => location.pathname.startsWith(k));
  const meta = (matchKey && TITLES[matchKey]) || { title: "Admin", subtitle: "" };

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: C.bg }}>
      <header
        className="px-6 py-5 border-b sticky top-0 z-10 backdrop-blur"
        style={{ borderColor: C.border, backgroundColor: `${C.surface}E6` }}
      >
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: C.text }}>
              {meta.title}
            </h1>
            {meta.subtitle && (
              <p className="text-sm" style={{ color: C.muted }}>
                {meta.subtitle}
              </p>
            )}
          </div>
          <Link
            to="/admin/dashboard"
            className="text-xs font-medium hidden sm:inline"
            style={{ color: C.muted }}
          >
            Admin Console
          </Link>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminShell;
