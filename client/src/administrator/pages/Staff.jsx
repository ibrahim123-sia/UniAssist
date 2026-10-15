import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Plus,
  Search,
  Copy,
  Check,
  UserPlus,
  UserX,
  ShieldCheck,
  Trash2,
  Pencil,
  Users as UsersIcon,
  BarChart3,
  Star,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import moment from "moment";
import {
  fetchStaff,
  createStaff,
  updateStaff,
  deactivateStaff,
  fetchStaffPerformance,
} from "../../redux/slices/adminStaffSlice";
import { fetchDepartments } from "../../redux/slices/departmentSlice";
import AdminTable, { AdminTableRow, AdminTableCell } from "../components/AdminTable";
import LoadingSkeleton from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import AdminModal from "../components/AdminModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { C } from "../../theme/palette";
import { useDebouncedSearch } from "../utils/useDebouncedSearch";
import { formatHours } from "../../utils/issues";

const VIEWS = [
  { key: "accounts", label: "Accounts", icon: UsersIcon },
  { key: "performance", label: "Performance", icon: BarChart3 },
];

// Count cell that fades zeros so the busy rows stand out.
const Num = ({ value, color }) => (
  <span className="tabular-nums" style={{ color: value ? color || C.text : C.muted }}>
    {value ?? 0}
  </span>
);

const Staff = () => {
  const dispatch = useDispatch();
  const {
    staff,
    total,
    loading,
    submitting,
    performance,
    performanceLoading,
    performanceLoaded,
    performanceError,
  } = useSelector((s) => s.adminStaff);
  const [view, setView] = useState("accounts");
  const departments = useSelector((s) => s.department.departments);

  const { input: searchInput, setInput: setSearchInput, search } = useDebouncedSearch();
  const [deptFilter, setDeptFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", departmentId: "", staffTitle: "" });
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", departmentId: "", staffTitle: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const query = useMemo(
    () => ({ departmentId: deptFilter || undefined, search }),
    [deptFilter, search]
  );

  useEffect(() => {
    dispatch(fetchStaff(query));
  }, [dispatch, query]);

  useEffect(() => {
    if (view === "performance") dispatch(fetchStaffPerformance());
  }, [dispatch, view]);

  // Performance comes back for every staff member at once; filter it here
  // with the same department + search controls as the accounts list.
  const performanceRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return performance.filter((p) => {
      if (deptFilter && String(p.department?._id || p.department) !== deptFilter) return false;
      if (!term) return true;
      return `${p.name || ""} ${p.email || ""}`.toLowerCase().includes(term);
    });
  }, [performance, deptFilter, search]);

  // Keyed on emptiness, not the array: each fetch returns a new (possibly
  // still empty) array, which would otherwise refetch forever.
  const hasDepartments = departments?.length > 0;
  useEffect(() => {
    if (!hasDepartments) dispatch(fetchDepartments());
  }, [dispatch, hasDepartments]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.departmentId) {
      toast.error("Name and department are required");
      return;
    }
    const result = await dispatch(createStaff(form)).unwrap();
    if (result.success) {
      toast.success("Staff account created");
      setCredentials(result.credentials);
      setForm({ name: "", departmentId: "", staffTitle: "" });
      setCreateOpen(false);
      dispatch(fetchStaff(query));
    } else {
      toast.error(result.message || "Failed to create staff");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const result = await dispatch(deactivateStaff(confirmDelete._id)).unwrap();
    if (result.success) {
      toast.success("Staff deactivated");
      setConfirmDelete(null);
    } else {
      toast.error(result.message || "Failed to deactivate");
    }
  };

  const openEdit = (staffer) => {
    setEditTarget(staffer);
    setEditForm({
      name: staffer.name || "",
      email: staffer.email || "",
      departmentId: staffer.department?._id || staffer.department || "",
      staffTitle: staffer.staffTitle || "",
    });
  };

  const closeEdit = () => {
    setEditTarget(null);
    setSavingEdit(false);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    const trimmedName = editForm.name.trim();
    const trimmedEmail = editForm.email.trim().toLowerCase();
    if (trimmedName.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,8}$/.test(trimmedEmail)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSavingEdit(true);
    const result = await dispatch(
      updateStaff({
        id: editTarget._id,
        name: trimmedName,
        email: trimmedEmail,
        departmentId: editForm.departmentId || undefined,
        staffTitle: editForm.staffTitle,
      })
    ).unwrap();
    setSavingEdit(false);
    if (result.success) {
      toast.success("Staff updated");
      closeEdit();
    } else {
      toast.error(result.message || "Failed to update staff");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-control border overflow-hidden" style={{ borderColor: C.borderStrong }}>
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className="px-3 py-2 text-sm flex items-center gap-1.5 transition-colors"
                style={{
                  backgroundColor: active ? C.primary : C.surface,
                  color: active ? C.onPrimary : C.label,
                }}
              >
                <Icon className="w-4 h-4" />
                {v.label}
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search staff..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
        {view === "accounts" ? (
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2.5 text-sm rounded-control font-bold text-on-primary flex items-center gap-2 bg-primary hover:bg-primary-hover transition-colors focus-ring"
          >
            <Plus className="w-4 h-4" />
            Add Staff
          </button>
        ) : (
          <button
            onClick={() => dispatch(fetchStaffPerformance())}
            className="px-3 py-2.5 text-sm rounded-control border flex items-center gap-2 bg-surface border-border-strong text-label hover:bg-nav-hover transition-colors focus-ring"
          >
            <RefreshCw className={`w-4 h-4 ${performanceLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      </div>

      {view === "performance" ? (
        <>
          <AdminTable
            columns={[
              { key: "name", label: "Staff" },
              { key: "department", label: "Dept" },
              { key: "assigned", label: "Assigned" },
              { key: "resolved", label: "Resolved" },
              { key: "open", label: "Open" },
              { key: "response", label: "Avg first response" },
              { key: "rating", label: "Avg rating" },
            ]}
          >
            {performanceLoading && !performanceLoaded ? (
              <LoadingSkeleton cols={7} />
            ) : performanceRows.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={BarChart3}
                      title={performanceError ? "Couldn't load performance" : "No staff to show"}
                      description={
                        performanceError ||
                        (search || deptFilter
                          ? "Try a different search or department."
                          : "Performance appears once staff start handling issues.")
                      }
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {performanceRows.map((p) => (
                  <AdminTableRow key={p._id}>
                    <AdminTableCell>
                      <div className="min-w-0">
                        <div className="font-medium truncate" style={{ color: C.text }}>
                          {p.name}
                        </div>
                        <div className="text-xs truncate" style={{ color: C.muted }}>
                          {p.email}
                        </div>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <span style={{ color: C.muted }} title={p.department?.name}>
                        {p.department?.code || "—"}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <Num value={p.assigned} />
                    </AdminTableCell>
                    <AdminTableCell>
                      <Num value={p.resolved} color={C.success} />
                    </AdminTableCell>
                    <AdminTableCell>
                      <Num value={p.open} color={C.warning} />
                    </AdminTableCell>
                    <AdminTableCell>
                      <span
                        className="whitespace-nowrap tabular-nums"
                        style={{ color: p.avgFirstResponseHours == null ? C.muted : C.text }}
                      >
                        {formatHours(p.avgFirstResponseHours)}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell>
                      {p.avgRating == null ? (
                        <span style={{ color: C.muted }}>—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums" style={{ color: C.text }}>
                          <Star className="w-3.5 h-3.5" style={{ color: "var(--chart-3)" }} fill="currentColor" />
                          {Number(p.avgRating).toFixed(1)}
                          <span className="text-xs" style={{ color: C.muted }}>
                            (n={p.ratingsCount ?? 0})
                          </span>
                        </span>
                      )}
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </tbody>
            )}
          </AdminTable>
          <p className="text-xs" style={{ color: C.muted }}>
            First response = time from a complaint being filed to the first staff reply, status change or
            assignment. Ratings come from students after an issue is resolved or closed.
          </p>
        </>
      ) : (
        <>
          <AdminTable
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "department", label: "Department" },
              { key: "title", label: "Title" },
              { key: "joined", label: "Joined" },
              { key: "status", label: "Status" },
              { key: "actions", label: "" },
            ]}
          >
            {loading ? (
              <LoadingSkeleton cols={7} />
            ) : staff.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={UserPlus}
                      title="No staff yet"
                      description="Click 'Add Staff' to create one. The system generates an email and password automatically."
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {staff.map((s) => (
                  <AdminTableRow key={s._id}>
                    <AdminTableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-nav-active-bg text-nav-active-text"
                        >
                          {s.name?.charAt(0)?.toUpperCase() || "S"}
                        </div>
                        <span className="font-medium" style={{ color: C.text }}>
                          {s.name}
                        </span>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <span style={{ color: C.muted }}>{s.email}</span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <span style={{ color: C.muted }}>{s.department?.code || "—"}</span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <span style={{ color: C.muted }}>{s.staffTitle || "—"}</span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <span style={{ color: C.muted }}>{moment(s.createdAt).format("MMM D, YYYY")}</span>
                    </AdminTableCell>
                    <AdminTableCell>
                      {s.isBlocked ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium"
                          style={{ backgroundColor: C.dangerBg, color: C.danger }}
                        >
                          <UserX className="w-3 h-3" /> Deactivated
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium"
                          style={{ backgroundColor: C.successBg, color: C.success }}
                        >
                          <ShieldCheck className="w-3 h-3" /> Active
                        </span>
                      )}
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 rounded transition-colors"
                          style={{ color: C.muted }}
                          aria-label="Edit"
                          onMouseEnter={(e) => (e.currentTarget.style.color = C.link)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {!s.isBlocked && (
                          <button
                            onClick={() => setConfirmDelete(s)}
                            className="p-1.5 rounded transition-colors"
                            style={{ color: C.muted }}
                            aria-label="Deactivate"
                            onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </tbody>
            )}
          </AdminTable>

          <p className="text-xs" style={{ color: C.muted }}>
            Total: {total} staff
          </p>
        </>
      )}

      <AdminModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Staff Member"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-3 py-2 text-sm rounded-control border bg-surface border-border-strong text-label hover:bg-nav-hover transition-colors focus-ring"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-staff-form"
              disabled={submitting}
              className="px-3 py-2 text-sm rounded-control font-bold text-on-primary disabled:opacity-50 bg-primary hover:bg-primary-hover transition-colors focus-ring"
            >
              {submitting ? "Creating..." : "Create staff"}
            </button>
          </>
        }
      >
        <form id="create-staff-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.label }}>
              Full name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ali Asad"
              required
              className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
            />
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              Email and password will be generated automatically.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.label }}>
              Department
            </label>
            <select
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              required
              className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
            >
              <option value="">Select department...</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.label }}>
              Staff title (optional)
            </label>
            <input
              type="text"
              value={form.staffTitle}
              onChange={(e) => setForm({ ...form, staffTitle: e.target.value })}
              placeholder="e.g. SFO, IT Staff, HOD"
              className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
            />
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title="Staff credentials"
        size="md"
        footer={
          <button
            type="button"
            onClick={() => setCredentials(null)}
            className="px-3 py-2 text-sm rounded-control font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors focus-ring"
          >
            Done
          </button>
        }
      >
        <p className="text-sm mb-4" style={{ color: C.text }}>
          The credentials below have also been emailed to the staff member. Make sure they
          change the password after first login.
        </p>
        <div
          className="rounded-control border p-4 space-y-3 font-mono text-sm"
          style={{ borderColor: C.border, backgroundColor: C.surfaceMuted }}
        >
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: C.muted }}>email</span>
            <span className="truncate" style={{ color: C.text }}>
              {credentials?.email}
            </span>
            <button
              onClick={() => copyToClipboard(credentials?.email)}
              className="p-1 rounded"
              style={{ color: C.link }}
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: C.muted }}>password</span>
            <span style={{ color: C.text }}>{credentials?.password}</span>
            <button
              onClick={() => copyToClipboard(credentials?.password)}
              className="p-1 rounded"
              style={{ color: C.link }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={!!editTarget}
        onClose={closeEdit}
        title="Edit staff member"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={closeEdit}
              className="px-3 py-2 text-sm rounded-control border bg-surface border-border-strong text-label hover:bg-nav-hover transition-colors focus-ring"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-staff-form"
              disabled={savingEdit}
              className="px-3 py-2 text-sm rounded-control font-bold text-on-primary disabled:opacity-50 bg-primary hover:bg-primary-hover transition-colors focus-ring"
            >
              {savingEdit ? "Saving..." : "Save changes"}
            </button>
          </>
        }
      >
        <form id="edit-staff-form" onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.label }}>
              Full name
            </label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
              className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.label }}>
              Email
            </label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              required
              className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
            />
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              The staff member will sign in with this email. Tell them after changing it.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.label }}>
              Department
            </label>
            <select
              value={editForm.departmentId}
              onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
            >
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.label }}>
              Staff title
            </label>
            <input
              type="text"
              value={editForm.staffTitle}
              onChange={(e) => setEditForm({ ...editForm, staffTitle: e.target.value })}
              placeholder="e.g. SFO, IT Staff, HOD"
              className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
            />
          </div>
        </form>
      </AdminModal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        destructive
        title="Deactivate staff?"
        message={`${confirmDelete?.name} will lose access to the portal. Their assigned issues will remain in history.`}
        confirmLabel="Deactivate"
      />
    </div>
  );
};

export default Staff;
