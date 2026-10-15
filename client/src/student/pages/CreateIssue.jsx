import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import { createIssue } from "../../redux/slices/issueSlice";
import { fetchDepartments } from "../../redux/slices/departmentSlice";

const CATEGORIES = [
  "finance",
  "academics",
  "IT",
  "administrative",
  "hostel",
  "library",
  "other",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 3;
const MAX_TITLE_CHARS = 200;
const MAX_DESCRIPTION_CHARS = 5000;
// Exactly what the server accepts. `image/*` would let SVG through, which
// the server rejects (SVG can carry script).
const ALLOWED_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
};
const ACCEPT = Object.entries(ALLOWED_TYPES).flat(2).join(",");

const isAllowedFile = (f) => {
  const exts = ALLOWED_TYPES[f.type];
  const name = f.name.toLowerCase();
  return !!exts && exts.some((ext) => name.endsWith(ext));
};

const CreateIssue = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const departments = useSelector((s) => s.department.departments);
  const submitting = useSelector((s) => s.issue.submitting);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [departmentId, setDepartmentId] = useState("");
  const [files, setFiles] = useState([]);

  useEffect(() => {
    dispatch(fetchDepartments());
  }, [dispatch]);

  useEffect(() => {
    if (!departmentId && departments.length > 0) {
      setDepartmentId(departments[0]._id);
    }
  }, [departments, departmentId]);

  const onFileChange = (e) => {
    const incoming = Array.from(e.target.files || []);
    e.target.value = "";
    const allowed = [];
    for (const f of incoming) {
      if (files.length + allowed.length >= MAX_FILES) {
        toast.error(`Max ${MAX_FILES} files`);
        break;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} exceeds 5MB`);
        continue;
      }
      if (!isAllowedFile(f)) {
        toast.error(`${f.name}: only PDF, JPEG, PNG, GIF or WebP allowed`);
        continue;
      }
      allowed.push(f);
    }
    setFiles((prev) => [...prev, ...allowed]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !departmentId) {
      toast.error("Title, description, and department are required");
      return;
    }
    if (title.trim().length > MAX_TITLE_CHARS) {
      toast.error(`Title must be at most ${MAX_TITLE_CHARS} characters`);
      return;
    }
    if (description.trim().length > MAX_DESCRIPTION_CHARS) {
      toast.error(`Description must be at most ${MAX_DESCRIPTION_CHARS} characters`);
      return;
    }
    if (files.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} files`);
      return;
    }
    const result = await dispatch(
      createIssue({ title: title.trim(), description: description.trim(), category, departmentId, files })
    ).unwrap();
    if (result.success) {
      toast.success("Issue submitted");
      navigate(`/issues/${result.issue._id}`);
    } else {
      toast.error(result.message || "Failed to submit issue");
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-bg text-text">
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <Link to="/issues" className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted hover:text-text focus-ring rounded">
          <ArrowLeft className="w-4 h-4" /> Back to issues
        </Link>

        <h1 className="text-2xl font-extrabold mb-1 text-heading">Submit a new issue</h1>
        <p className="text-sm mb-6 text-muted">
          Pick the right department so the issue reaches the right team.
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="p-5 border bg-surface border-border rounded-card shadow-card">
            <label className="block text-[13px] font-semibold mb-[7px] text-label">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of your issue"
              maxLength={MAX_TITLE_CHARS}
              className="w-full px-3 py-2.5 border text-sm bg-input-bg rounded-control border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-5 border bg-surface border-border rounded-card shadow-card">
              <label className="block text-[13px] font-semibold mb-[7px] text-label">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2.5 border text-sm bg-input-bg rounded-control border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
              >
                {departments.length === 0 && <option value="">No departments available</option>}
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
              <p className="text-xs mt-1.5 text-muted">
                SFC = Student Facilitation Center, IT = Tech support, HOD = Head of Department
              </p>
            </div>

            <div className="p-5 border bg-surface border-border rounded-card shadow-card">
              <label className="block text-[13px] font-semibold mb-[7px] text-label">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 border text-sm bg-input-bg rounded-control border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-5 border bg-surface border-border rounded-card shadow-card">
            <label className="block text-[13px] font-semibold mb-[7px] text-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESCRIPTION_CHARS}
              rows={6}
              placeholder="Describe your issue in detail. Include relevant dates, IDs, screenshots references."
              className="w-full px-3 py-2.5 border text-sm resize-y bg-input-bg rounded-control border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
            />
          </div>

          <div className="p-5 border bg-surface border-border rounded-card shadow-card">
            <label className="block text-[13px] font-semibold mb-[7px] text-label">Attachments (optional)</label>
            <p className="text-xs mb-3 text-muted">
              PDF, JPEG, PNG, GIF or WebP. Max {MAX_FILES} files, 5MB each.
            </p>
            <label
              className="inline-flex items-center gap-2 px-3 py-2 rounded-control cursor-pointer text-sm font-semibold bg-surface border border-border-strong text-label hover:bg-nav-hover focus-ring transition-colors"
            >
              <Upload className="w-4 h-4" /> Add files
              <input
                type="file"
                multiple
                accept={ACCEPT}
                onChange={onFileChange}
                className="hidden"
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 border border-border text-sm bg-surface-muted rounded-control text-text"
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      {f.type === "application/pdf" ? (
                        <FileText className="w-4 h-4 shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 shrink-0" />
                      )}
                      <span className="truncate">{f.name}</span>
                      <span className="text-muted">({(f.size / 1024).toFixed(0)} KB)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-muted hover:text-danger focus-ring rounded"
                      aria-label="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || departments.length === 0}
              className="px-5 py-2.5 text-sm rounded-control font-bold bg-primary text-on-primary hover:bg-primary-hover focus-ring disabled:bg-disabled-bg disabled:text-disabled-text transition-colors"
            >
              {submitting ? "Registering…" : "Submit issue"}
            </button>
            <Link
              to="/issues"
              className="px-5 py-2.5 rounded-control font-bold text-sm bg-surface border border-border-strong text-label hover:bg-nav-hover focus-ring transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateIssue;
