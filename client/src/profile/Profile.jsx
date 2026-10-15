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
    <div className="h-full overflow-y-auto bg-bg text-text">
      <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">Your profile</h1>
          <p className="text-sm mt-1 text-muted">
            Manage your photo, display name, and password.
          </p>
        </header>

        {/* Profile card */}
        <form
          onSubmit={onSaveProfile}
          className="p-6 rounded-card border bg-surface border-border shadow-card space-y-5"
        >
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-primary"
              >
                {currentAvatarUrl ? (
                  <img src={currentAvatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-on-primary font-bold text-3xl">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center shadow-card border-2 bg-surface border-border text-label hover:bg-nav-hover focus-ring"
                title="Change profile picture"
                aria-label="Change profile picture"
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
              <p className="text-lg font-bold truncate text-heading">{user?.name}</p>
              <p className="text-sm text-muted">{user?.email}</p>
              <p className="text-xs mt-1 inline-flex items-center gap-1.5 text-muted">
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
              <label htmlFor="profile-name" className="text-[13px] font-semibold block mb-[7px] text-label">
                Display name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-label" />
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-control border text-[15px] bg-input-bg border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
                />
              </div>
            </div>
            <div>
              <label htmlFor="profile-email" className="text-[13px] font-semibold block mb-[7px] text-label">
                Email (read-only)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-label" />
                <input
                  id="profile-email"
                  type="email"
                  value={user?.email || ""}
                  readOnly
                  className="w-full pl-10 pr-3 py-2.5 rounded-control border text-[15px] bg-disabled-bg border-input-border text-muted focus:outline-none focus:shadow-[var(--focus-ring)]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-1 flex-wrap gap-3">
            <p className="text-xs text-muted">
              Image must be JPG/PNG/WebP and under 2MB.
            </p>
            <button
              type="submit"
              disabled={savingProfile || (name.trim() === user?.name && !avatarFile)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary hover:bg-primary-hover text-on-primary text-sm font-bold transition-colors focus-ring disabled:bg-disabled-bg disabled:text-disabled-text"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        {/* Change password card */}
        <form
          onSubmit={onChangePassword}
          className="p-6 rounded-card border bg-surface border-border shadow-card space-y-4"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-bold text-heading">Change password</h2>
          </div>
          <p className="text-xs text-muted">
            You'll need your current password. Choose a new one of at least 6 characters.
          </p>

          <div>
            <label htmlFor="profile-current-password" className="text-[13px] font-semibold block mb-[7px] text-label">
              Current password
            </label>
            <div className="relative">
              <input
                id="profile-current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 rounded-control border text-[15px] bg-input-bg border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-label hover:text-text focus-ring"
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-new-password" className="text-[13px] font-semibold block mb-[7px] text-label">
                New password
              </label>
              <div className="relative">
                <input
                  id="profile-new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 rounded-control border text-[15px] bg-input-bg border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-label hover:text-text focus-ring"
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="profile-confirm-password" className="text-[13px] font-semibold block mb-[7px] text-label">
                Confirm new password
              </label>
              <input
                id="profile-confirm-password"
                type={showNew ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-control border text-[15px] bg-input-bg border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
                autoComplete="new-password"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs mt-1 text-danger">
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary hover:bg-primary-hover text-on-primary text-sm font-bold transition-colors focus-ring disabled:bg-disabled-bg disabled:text-disabled-text"
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
