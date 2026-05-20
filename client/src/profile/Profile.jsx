import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Camera,
  Lock,
  Mail,
  User as UserIcon,
  Building2,
  Shield,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";
import { updateProfile, changePassword } from "../redux/slices/authSlice";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

const Profile = () => {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const theme = useSelector((s) => s.theme.theme);
  const isDark = theme === "dark";

  const fileRef = useRef(null);
  const [name, setName] = useState(user?.name || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Revoke any pending object URL when the preview changes or the user
  // navigates away with an unsaved selection — prevents memory leaks.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const C = {
    bg: isDark ? "#0E1422" : "#F2F3F8",
    surface: isDark ? "#16203A" : "#FFFFFF",
    surfaceAlt: isDark ? "#1E2A47" : "#F2F3F8",
    input: isDark ? "#0B1120" : "#FFFFFF",
    border: isDark ? "#2A3656" : "#D8DAE6",
    text: isDark ? "#ECEEF5" : "#1F2330",
    muted: isDark ? "#9AA5BD" : "#5A6372",
    navy: isDark ? "#E63027" : "#1E2A66",
    red: isDark ? "#C48A4A" : "#E63027",
    green: isDark ? "#6FB58A" : "#2F8A56",
  };

  const onPickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB.");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onSaveProfile = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }
    if (trimmed === user.name && !avatarFile) {
      toast("Nothing to save.", { icon: "ℹ️" });
      return;
    }
    setSavingProfile(true);
    const result = await dispatch(
      updateProfile({
        name: trimmed === user.name ? undefined : trimmed,
        avatarFile,
      })
    ).unwrap();
    setSavingProfile(false);
    if (result.success) {
      toast.success("Profile updated");
      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    } else {
      toast.error(result.message || "Failed to update profile");
    }
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Fill in both passwords.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation don't match.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from the current one.");
      return;
    }
    setChangingPw(true);
    const result = await dispatch(
      changePassword({ currentPassword, newPassword })
    ).unwrap();
    setChangingPw(false);
    if (result.success) {
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      toast.error(result.message || "Failed to change password");
    }
  };

  const currentAvatarUrl =
    avatarPreview ||
    (user?.profilePicture ? `${SERVER_URL}${user.profilePicture}` : null);

  const roleLabel =
    user?.role === "admin" ? "Administrator" :
    user?.role === "staff" ? (user?.staffTitle || "Staff") :
    "Student";

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: C.bg, color: C.text }}>
      <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Your profile</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            Manage your photo, display name, and password.
          </p>
        </header>

        {/* Profile card */}
        <form
          onSubmit={onSaveProfile}
          className="p-6 rounded-xl border space-y-5"
          style={{ backgroundColor: C.surface, borderColor: C.border }}
        >
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: C.navy }}
              >
                {currentAvatarUrl ? (
                  <img src={currentAvatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-3xl">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center shadow-md border-2"
                style={{ backgroundColor: C.surface, borderColor: C.border, color: C.text }}
                title="Change profile picture"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickAvatar}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold truncate">{user?.name}</p>
              <p className="text-sm" style={{ color: C.muted }}>{user?.email}</p>
              <p className="text-xs mt-1 inline-flex items-center gap-1.5" style={{ color: C.muted }}>
                <Shield className="w-3.5 h-3.5" /> {roleLabel}
                {user?.department?.code && (
                  <>
                    <span>·</span>
                    <Building2 className="w-3.5 h-3.5" /> {user.department.code}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase block mb-1.5" style={{ color: C.muted }}>
                Display name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-lg border text-sm focus:outline-none"
                  style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase block mb-1.5" style={{ color: C.muted }}>
                Email (read-only)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
                <input
                  type="email"
                  value={user?.email || ""}
                  readOnly
                  className="w-full pl-10 pr-3 py-2 rounded-lg border text-sm focus:outline-none"
                  style={{ backgroundColor: C.surfaceAlt, borderColor: C.border, color: C.muted }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-1 flex-wrap gap-3">
            <p className="text-xs" style={{ color: C.muted }}>
              Image must be JPG/PNG/WebP and under 2MB.
            </p>
            <button
              type="submit"
              disabled={savingProfile || (name.trim() === user?.name && !avatarFile)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: C.navy }}
            >
              <Save className="w-4 h-4" />
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        {/* Change password card */}
        <form
          onSubmit={onChangePassword}
          className="p-6 rounded-xl border space-y-4"
          style={{ backgroundColor: C.surface, borderColor: C.border }}
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" style={{ color: C.navy }} />
            <h2 className="text-base font-semibold">Change password</h2>
          </div>
          <p className="text-xs" style={{ color: C.muted }}>
            You'll need your current password. Choose a new one of at least 6 characters.
          </p>

          <div>
            <label className="text-xs font-semibold uppercase block mb-1.5" style={{ color: C.muted }}>
              Current password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg border text-sm focus:outline-none"
                style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                style={{ color: C.muted }}
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase block mb-1.5" style={{ color: C.muted }}>
                New password
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-lg border text-sm focus:outline-none"
                  style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                  style={{ color: C.muted }}
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase block mb-1.5" style={{ color: C.muted }}>
                Confirm new password
              </label>
              <input
                type={showNew ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
                autoComplete="new-password"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs mt-1" style={{ color: C.red }}>
                  Passwords don't match.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={
                changingPw ||
                !currentPassword ||
                !newPassword ||
                newPassword !== confirmPassword
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: C.navy }}
            >
              <Lock className="w-4 h-4" />
              {changingPw ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
