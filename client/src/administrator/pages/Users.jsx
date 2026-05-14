import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Search, Flag, UserX, ShieldCheck, Users as UsersIcon, X } from "lucide-react";
import toast from "react-hot-toast";
import moment from "moment";
import {
  fetchAdminUsers,
  fetchUserActivity,
  toggleBlockUser,
  clearSelectedUser,
} from "../../redux/slices/adminUserSlice";
import AdminTable, { AdminTableRow, AdminTableCell } from "../components/AdminTable";
import LoadingSkeleton from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import { getPalette } from "../utils/palette";

const PAGE_SIZE = 25;

const Users = () => {
  const dispatch = useDispatch();
  const theme = useSelector((s) => s.theme.theme);
  const C = getPalette(theme === "dark");
  const { users, total, loading, selectedUser, selectedActivity, detailLoading, submitting } =
    useSelector((s) => s.adminUser);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | blocked | flagged
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(null);

  const query = useMemo(() => {
    const q = { role: "student", search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
    if (filter === "blocked") q.isBlocked = true;
    if (filter === "flagged") q.flaggedOnly = true;
    return q;
  }, [search, filter, page]);

  useEffect(() => {
    dispatch(fetchAdminUsers(query));
  }, [dispatch, query]);

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  const openDetail = (id) => {
    setDrawerOpen(true);
    dispatch(fetchUserActivity(id));
  };

  const closeDetail = () => {
    setDrawerOpen(false);
    dispatch(clearSelectedUser());
  };

  const doToggleBlock = async () => {
    if (!selectedUser) return;
    const next = !selectedUser.isBlocked;
    const result = await dispatch(toggleBlockUser({ id: selectedUser._id, isBlocked: next })).unwrap();
    if (result.success) {
      toast.success(next ? "Student blocked" : "Student unblocked");
      setConfirmBlock(null);
    } else {
      toast.error(result.message || "Action failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border focus:outline-none"
            style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
          />
        </div>
        <div className="flex items-center gap-2">
          {[
            { key: "all", label: "All" },
            { key: "blocked", label: "Blocked" },
            { key: "flagged", label: "Flagged" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 text-sm rounded-lg border transition-colors"
              style={{
                backgroundColor: filter === f.key ? C.navy : C.surface,
                color: filter === f.key ? "#fff" : C.text,
                borderColor: filter === f.key ? C.navy : C.border,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <AdminTable
        columns={[
          { key: "name", label: "Student" },
          { key: "email", label: "Email" },
          { key: "joined", label: "Joined" },
          { key: "lastLogin", label: "Last login" },
          { key: "status", label: "Status" },
        ]}
      >
        {loading ? (
          <LoadingSkeleton cols={5} />
        ) : users.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={5}>
                <EmptyState
                  icon={UsersIcon}
                  title="No students found"
                  description={search ? "Try a different search." : "No students match these filters."}
                />
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {users.map((u) => (
              <AdminTableRow key={u._id} onClick={() => openDetail(u._id)} highlight={u.flags?.length > 0}>
                <AdminTableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                      style={{ backgroundColor: C.navy }}
                    >
                      {u.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2" style={{ color: C.text }}>
                        {u.name}
                        {u.flags?.length > 0 && (
                          <Flag className="w-3.5 h-3.5" style={{ color: C.red }} />
                        )}
                      </div>
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <span style={{ color: C.muted }}>{u.email}</span>
                </AdminTableCell>
                <AdminTableCell>
                  <span style={{ color: C.muted }}>{moment(u.createdAt).format("MMM D, YYYY")}</span>
                </AdminTableCell>
                <AdminTableCell>
                  <span style={{ color: C.muted }}>
                    {u.lastLoginAt ? moment(u.lastLoginAt).fromNow() : "never"}
                  </span>
                </AdminTableCell>
                <AdminTableCell>
                  {u.isBlocked ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium"
                      style={{ backgroundColor: `${C.red}1A`, color: C.red }}
                    >
                      <UserX className="w-3 h-3" /> Blocked
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium"
                      style={{ backgroundColor: `${C.green}1A`, color: C.green }}
                    >
                      <ShieldCheck className="w-3 h-3" /> Active
                    </span>
                  )}
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </tbody>
        )}
      </AdminTable>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={closeDetail}>
          <div className="flex-1" style={{ backgroundColor: "rgba(15, 22, 38, 0.5)" }} />
          <aside
            className="w-full sm:w-[480px] h-full overflow-y-auto border-l"
            style={{ backgroundColor: C.surface, borderColor: C.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <header
              className="px-5 py-4 border-b flex items-center justify-between sticky top-0 z-10"
              style={{ borderColor: C.border, backgroundColor: C.surface }}
            >
              <h2 className="text-base font-semibold" style={{ color: C.text }}>
                Student detail
              </h2>
              <button onClick={closeDetail} className="p-1 rounded" style={{ color: C.muted }}>
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="p-5 space-y-5">
              {detailLoading && (
                <div className="text-sm" style={{ color: C.muted }}>
                  Loading...
                </div>
              )}
              {selectedUser && (
                <>
                  <section className="flex items-start gap-3">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold text-white shrink-0"
                      style={{ backgroundColor: C.navy }}
                    >
                      {selectedUser.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: C.text }}>
                        {selectedUser.name}
                        {selectedUser.flags?.length > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium"
                            style={{ backgroundColor: `${C.red}1A`, color: C.red }}
                          >
                            <Flag className="w-3 h-3" /> {selectedUser.flags.length} flag(s)
                          </span>
                        )}
                      </h3>
                      <p className="text-sm" style={{ color: C.muted }}>
                        {selectedUser.email}
                      </p>
                      <p className="text-xs mt-1" style={{ color: C.muted }}>
                        Joined {moment(selectedUser.createdAt).format("MMM D, YYYY")} ·{" "}
                        Last login{" "}
                        {selectedActivity?.lastLoginAt
                          ? moment(selectedActivity.lastLoginAt).fromNow()
                          : "never"}
                      </p>
                    </div>
                  </section>

                  <button
                    onClick={() => setConfirmBlock(selectedUser)}
                    className="w-full px-4 py-2 text-sm font-medium rounded-lg text-white"
                    style={{ backgroundColor: selectedUser.isBlocked ? C.green : C.red }}
                  >
                    {selectedUser.isBlocked ? "Unblock student" : "Block student"}
                  </button>

                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>
                      Submitted issues ({selectedActivity?.issues?.length || 0})
                    </h4>
                    <ul className="space-y-2">
                      {(selectedActivity?.issues || []).map((iss) => (
                        <li
                          key={iss._id}
                          className="text-sm p-3 rounded-lg border"
                          style={{ borderColor: C.border, backgroundColor: C.surfaceAlt }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate" style={{ color: C.text }}>
                              {iss.title}
                            </span>
                            <span
                              className="px-2 py-0.5 text-xs rounded-full"
                              style={{ backgroundColor: `${C.navy}1A`, color: C.navy }}
                            >
                              {iss.status}
                            </span>
                          </div>
                          <p className="text-xs mt-1" style={{ color: C.muted }}>
                            {iss.department?.code || "—"} · {moment(iss.createdAt).fromNow()}
                          </p>
                        </li>
                      ))}
                      {(!selectedActivity?.issues || selectedActivity.issues.length === 0) && (
                        <li className="text-sm" style={{ color: C.muted }}>
                          No issues submitted.
                        </li>
                      )}
                    </ul>
                  </section>

                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>
                      Recent chats ({selectedActivity?.chats?.length || 0})
                    </h4>
                    <ul className="space-y-2">
                      {(selectedActivity?.chats || []).map((c) => (
                        <li
                          key={c._id}
                          className="text-sm p-3 rounded-lg border"
                          style={{ borderColor: C.border, backgroundColor: C.surfaceAlt }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate" style={{ color: C.text }}>
                              {c.name}
                            </span>
                            <span className="text-xs" style={{ color: C.muted }}>
                              {c.messageCount} msg
                            </span>
                          </div>
                          {c.lastMessage && (
                            <p className="text-xs mt-1 line-clamp-2" style={{ color: C.muted }}>
                              {c.lastMessage}
                            </p>
                          )}
                          <p className="text-xs mt-1" style={{ color: C.muted }}>
                            {moment(c.updatedAt).fromNow()}
                          </p>
                        </li>
                      ))}
                      {(!selectedActivity?.chats || selectedActivity.chats.length === 0) && (
                        <li className="text-sm" style={{ color: C.muted }}>
                          No chats yet.
                        </li>
                      )}
                    </ul>
                  </section>

                  {selectedActivity?.flags?.length > 0 && (
                    <section>
                      <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.red }}>
                        Moderation flags ({selectedActivity.flags.length})
                      </h4>
                      <ul className="space-y-2">
                        {selectedActivity.flags.map((f, idx) => (
                          <li
                            key={f._id || idx}
                            className="text-sm p-3 rounded-lg border"
                            style={{ borderColor: `${C.red}55`, backgroundColor: `${C.red}10` }}
                          >
                            <p className="font-medium" style={{ color: C.text }}>
                              {f.type}
                            </p>
                            <p className="text-xs italic mt-1" style={{ color: C.muted }}>
                              "{f.message}"
                            </p>
                            <p className="text-xs mt-1" style={{ color: C.muted }}>
                              {moment(f.timestamp).fromNow()}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmBlock}
        onClose={() => setConfirmBlock(null)}
        onConfirm={doToggleBlock}
        loading={submitting}
        destructive={!confirmBlock?.isBlocked}
        title={confirmBlock?.isBlocked ? "Unblock student?" : "Block student?"}
        message={
          confirmBlock?.isBlocked
            ? `${confirmBlock?.name} will be able to log in and use the portal again.`
            : `${confirmBlock?.name} will be force-logged-out and won't be able to use the portal.`
        }
        confirmLabel={confirmBlock?.isBlocked ? "Unblock" : "Block"}
      />
    </div>
  );
};

export default Users;
