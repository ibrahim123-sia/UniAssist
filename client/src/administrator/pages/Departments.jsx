import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Plus, Edit2, Building2, Power, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import moment from "moment";
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
  fetchStaffOptions,
} from "../../redux/slices/departmentSlice";
import AdminTable, { AdminTableRow, AdminTableCell } from "../components/AdminTable";
import AdminModal from "../components/AdminModal";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import { getPalette } from "../utils/palette";

const SLA_MIN = 1;
const SLA_MAX = 720;

const idOf = (ref) => (ref && typeof ref === "object" ? ref._id : ref) || "";

const Departments = () => {
  const dispatch = useDispatch();
  const theme = useSelector((s) => s.theme.theme);
  const C = getPalette(theme === "dark");
  const { departments, loading, submitting } = useSelector((s) => s.department);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  // Department being edited in the modal (null = closed).
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", slaHours: "", head: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  // Staff of the department being edited, for the "Department head" picker.
  const [deptStaff, setDeptStaff] = useState({ loading: false, users: [] });
  // id → name for every staff member, so the table can name each head.
  const [staffNames, setStaffNames] = useState({});
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);

  useEffect(() => {
    dispatch(fetchDepartments());
    dispatch(fetchStaffOptions())
      .unwrap()
      .then((result) => {
        if (!result.success) return;
        setStaffNames(Object.fromEntries((result.users || []).map((u) => [u._id, u.name])));
      })
      .catch(() => {});
  }, [dispatch]);

  const headName = (d) => {
    if (!d.head) return null;
    if (typeof d.head === "object" && d.head.name) return d.head.name;
    return staffNames[idOf(d.head)] || "Assigned";
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    const result = await dispatch(createDepartment(form)).unwrap();
    if (result.success) {
      toast.success(`Department ${result.department.code} created`);
      setForm({ code: "", name: "", description: "" });
      setCreateOpen(false);
    } else {
      toast.error(result.message || "Failed to create department");
    }
  };

  const editSeqRef = useRef(0);
  const startEdit = (d) => {
    setEditing(d);
    setEditForm({
      name: d.name,
      description: d.description || "",
      slaHours: d.slaHours ? String(d.slaHours) : "",
      head: idOf(d.head),
    });
    setDeptStaff({ loading: true, users: [] });
    // Only the most recently opened department may fill the head picker, so
    // a slow response for one closed earlier can't list the wrong staff.
    const seq = ++editSeqRef.current;
    dispatch(fetchStaffOptions({ departmentId: d._id }))
      .unwrap()
      .then((result) => {
        if (seq === editSeqRef.current) {
          setDeptStaff({ loading: false, users: result.success ? result.users || [] : [] });
        }
      })
      .catch(() => {
        if (seq === editSeqRef.current) setDeptStaff({ loading: false, users: [] });
      });
  };

  const closeEdit = () => {
    if (!savingEdit) setEditing(null);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    const slaText = editForm.slaHours.trim();
    const sla = slaText ? Number(slaText) : null;
    if (sla !== null && (!Number.isInteger(sla) || sla < SLA_MIN || sla > SLA_MAX)) {
      toast.error(`SLA must be a whole number of hours between ${SLA_MIN} and ${SLA_MAX}`);
      return;
    }
    // SLA and head go only when changed: the server re-validates a head on
    // every write, and a since-deactivated head would block unrelated edits.
    const changes = { id: editing._id, name: editForm.name.trim(), description: editForm.description };
    if (sla !== (editing.slaHours ?? null)) changes.slaHours = sla;
    if (editForm.head !== idOf(editing.head)) changes.head = editForm.head || null;
    setSavingEdit(true);
    const result = await dispatch(updateDepartment(changes)).unwrap();
    setSavingEdit(false);
    if (result.success) {
      toast.success("Department updated");
      setEditing(null);
    } else {
      toast.error(result.message || "Failed to update");
    }
  };

  // Active staff, plus the current head even if since deactivated so the
  // select still shows who it is.
  const headOptions = deptStaff.users.filter((u) => !u.isBlocked || u._id === editForm.head);

  const reactivate = async (d) => {
    const result = await dispatch(updateDepartment({ id: d._id, isActive: true })).unwrap();
    if (result.success) toast.success("Department reactivated");
    else toast.error(result.message || "Failed");
  };

  const doDeactivate = async () => {
    if (!confirmDeactivate) return;
    const result = await dispatch(deactivateDepartment(confirmDeactivate._id)).unwrap();
    if (result.success) {
      toast.success("Department deactivated");
      setConfirmDeactivate(null);
    } else {
      toast.error(result.message || "Failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 text-sm rounded-lg font-medium text-white flex items-center gap-2"
          style={{ backgroundColor: C.navy }}
        >
          <Plus className="w-4 h-4" />
          New Department
        </button>
      </div>

      <AdminTable
        columns={[
          { key: "code", label: "Code", width: 120 },
          { key: "name", label: "Name" },
          { key: "description", label: "Description" },
          { key: "sla", label: "SLA" },
          { key: "head", label: "Head" },
          { key: "created", label: "Created" },
          { key: "status", label: "Status" },
          { key: "actions", label: "" },
        ]}
      >
        {departments.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={8}>
                <EmptyState
                  icon={Building2}
                  title={loading ? "Loading..." : "No departments yet"}
                  description={!loading && "Create your first department to start routing issues."}
                />
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {departments.map((d) => (
              <AdminTableRow key={d._id}>
                <AdminTableCell>
                  <span className="font-mono font-semibold" style={{ color: C.text }}>
                    {d.code}
                  </span>
                </AdminTableCell>
                <AdminTableCell>
                  <span style={{ color: C.text }}>{d.name}</span>
                </AdminTableCell>
                <AdminTableCell>
                  <span style={{ color: C.muted }}>{d.description || "—"}</span>
                </AdminTableCell>
                <AdminTableCell>
                  <span
                    className="whitespace-nowrap"
                    style={{ color: d.slaHours ? C.text : C.muted }}
                    title={d.slaHours ? "Custom response time" : "Uses the system default response time"}
                  >
                    {d.slaHours ? `${d.slaHours} h` : "Default"}
                  </span>
                </AdminTableCell>
                <AdminTableCell>
                  <span style={{ color: d.head ? C.text : C.muted }}>{headName(d) || "—"}</span>
                </AdminTableCell>
                <AdminTableCell>
                  <span style={{ color: C.muted }}>{moment(d.createdAt).format("MMM D, YYYY")}</span>
                </AdminTableCell>
                <AdminTableCell>
                  {d.isActive ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium"
                      style={{ backgroundColor: `${C.green}1A`, color: C.green }}
                    >
                      Active
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium"
                      style={{ backgroundColor: `${C.red}1A`, color: C.red }}
                    >
                      Inactive
                    </span>
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => startEdit(d)}
                      aria-label="Edit department"
                      className="p-1.5 rounded transition-colors"
                      style={{ color: C.muted }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = C.navy)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {d.isActive ? (
                      <button
                        onClick={() => setConfirmDeactivate(d)}
                        className="p-1.5 rounded transition-colors"
                        style={{ color: C.muted }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivate(d)}
                        className="p-1.5 rounded text-xs px-2"
                        style={{ color: C.green }}
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </tbody>
        )}
      </AdminTable>

      <AdminModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Department"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-3 py-2 text-sm rounded-lg border"
              style={{ borderColor: C.border, color: C.text }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-dept-form"
              disabled={submitting}
              className="px-3 py-2 text-sm rounded-lg font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: C.navy }}
            >
              {submitting ? "Creating..." : "Create"}
            </button>
          </>
        }
      >
        <form id="create-dept-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: C.muted }}>
              Code (uppercase, unique)
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="SFC"
              required
              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none font-mono"
              style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: C.muted }}>
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Student Facilitation Center"
              required
              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: C.muted }}>
              Description (optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
            />
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={!!editing}
        onClose={closeEdit}
        title={editing ? `Edit ${editing.code}` : "Edit department"}
        footer={
          <>
            <button
              type="button"
              onClick={closeEdit}
              disabled={savingEdit}
              className="px-3 py-2 text-sm rounded-lg border disabled:opacity-50"
              style={{ borderColor: C.border, color: C.text }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-dept-form"
              disabled={savingEdit}
              className="px-3 py-2 text-sm rounded-lg font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: C.navy }}
            >
              {savingEdit ? "Saving..." : "Save changes"}
            </button>
          </>
        }
      >
        <form id="edit-dept-form" onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: C.muted }}>
              Name
            </label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: C.muted }}>
              Description (optional)
            </label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
            />
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              Also used to route chatbot complaints to this department.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: C.muted }}>
              Response time (SLA, hours)
            </label>
            <input
              type="number"
              min={SLA_MIN}
              max={SLA_MAX}
              step={1}
              value={editForm.slaHours}
              onChange={(e) => setEditForm({ ...editForm, slaHours: e.target.value })}
              placeholder="Default"
              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
              style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
            />
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              A pending issue with no staff response after this long is escalated to the department head
              and admins. Leave empty for the system default (48 h unless configured).
            </p>
          </div>
          <div>
            <label className="flex items-center justify-between text-xs font-medium mb-1" style={{ color: C.muted }}>
              <span>Department head (optional)</span>
              {deptStaff.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </label>
            <select
              value={editForm.head}
              onChange={(e) => setEditForm({ ...editForm, head: e.target.value })}
              disabled={deptStaff.loading}
              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none disabled:opacity-60"
              style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
            >
              <option value="">No head — notify all department staff</option>
              {headOptions.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                  {u.staffTitle ? ` · ${u.staffTitle}` : ""}
                  {u.isBlocked ? " (deactivated)" : ""}
                </option>
              ))}
              {editForm.head && !deptStaff.loading && !headOptions.some((u) => u._id === editForm.head) && (
                <option value={editForm.head}>{staffNames[editForm.head] || "Current head"}</option>
              )}
            </select>
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              {!deptStaff.loading && deptStaff.users.length === 0
                ? "This department has no staff yet — add some on the Staff page."
                : "Receives escalation alerts for overdue issues."}
            </p>
          </div>
        </form>
      </AdminModal>

      <ConfirmDialog
        open={!!confirmDeactivate}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={doDeactivate}
        destructive
        title="Deactivate department?"
        message={`${confirmDeactivate?.code} (${confirmDeactivate?.name}) will be hidden from students. Existing issues are preserved.`}
        confirmLabel="Deactivate"
      />
    </div>
  );
};

export default Departments;
