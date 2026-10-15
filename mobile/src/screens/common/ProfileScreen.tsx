import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Alert, Pressable, ActivityIndicator } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { LogOut, Camera, Moon, Sun, HelpCircle, ChevronRight } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "../../hooks/useTheme";
import { Avatar } from "../../components/Avatar";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { logout, setUser, startSession, type User } from "../../redux/slices/authSlice";
import { toggleTheme } from "../../redux/slices/themeSlice";
import { apiUpdateProfile, apiChangePassword, type PickedFile } from "../../api/profile";
import { errorMessage } from "../../api/client";
import type { AppDispatch, RootState } from "../../redux/store";

// What PATCH /api/user/profile accepts for `avatar`.
const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const mimeFromUri = (uri: string) => {
  const ext = uri.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext && ["png", "gif", "webp"].includes(ext)) return `image/${ext}`;
  return "";
};

const Row = ({ label, value, C }: { label: string; value?: string | number | null; C: any }) =>
  value ? (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: C.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 12, fontWeight: "600", flexShrink: 1, textAlign: "right" }}>
        {String(value)}
      </Text>
    </View>
  ) : null;

export default function ProfileScreen({ navigation }: any) {
  const { C, isDark } = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);

  const [name, setName] = useState(user?.name || "");
  const [avatar, setAvatar] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  // Upload progress of a new picture (0-100), null when not uploading one.
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => { setName(user?.name || ""); }, [user?.name]);

  const onPickAvatar = async () => {
    if (saving) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Photo library permission is required");
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1],
    });
    const asset = r.canceled ? null : r.assets?.[0];
    if (!asset) return;
    const type = (asset.mimeType || mimeFromUri(asset.uri)).toLowerCase();
    if (!AVATAR_TYPES[type]) {
      return Alert.alert("Unsupported image", "Choose a JPG, PNG, GIF or WebP image.");
    }
    if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
      return Alert.alert("Image too large", "Profile pictures must be 2MB or smaller.");
    }
    setAvatar({ uri: asset.uri, type, name: `avatar.${AVATAR_TYPES[type]}` });
  };

  const trimmedName = name.trim();
  const dirty = !!avatar || (!!user && trimmedName !== user.name);

  const onSave = async () => {
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return Alert.alert("Name must be between 2 and 80 characters");
    }
    setSaving(true);
    if (avatar) setUploadPct(0);
    try {
      const { data } = await apiUpdateProfile(
        { name: trimmedName, avatar: avatar || undefined },
        avatar ? setUploadPct : undefined
      );
      if (data?.user) dispatch(setUser(data.user as User));
      setAvatar(null);
      Alert.alert("Profile updated");
    } catch (e) {
      Alert.alert("Couldn't save", errorMessage(e));
    } finally {
      setSaving(false);
      setUploadPct(null);
    }
  };

  const onChangePassword = async () => {
    if (!currentPassword || !newPassword) return Alert.alert("Fill in both passwords");
    if (newPassword.length < 6) return Alert.alert("New password must be at least 6 characters");
    if (newPassword !== confirmPassword) return Alert.alert("Passwords don't match");
    if (newPassword === currentPassword) return Alert.alert("New password must differ from the current one");
    setChangingPw(true);
    try {
      const { data } = await apiChangePassword(currentPassword, newPassword);
      // Every token issued before the change is now rejected; keep this
      // session alive on the fresh one.
      if (data?.token) await dispatch(startSession({ token: data.token }));
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      Alert.alert("Password changed", "Other devices signed in to this account will need to sign in again.");
    } catch (e) {
      Alert.alert("Couldn't change password", errorMessage(e));
    } finally {
      setChangingPw(false);
    }
  };

  const onLogout = () =>
    Alert.alert("Sign out?", "You'll need to log in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => dispatch(logout()) },
    ]);

  if (!user) return null;

  const saveLabel = uploadPct === null
    ? "Saving…"
    : uploadPct < 100 ? `Uploading picture… ${uploadPct}%` : "Saving picture…";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Pressable onPress={onPickAvatar} disabled={saving} accessibilityLabel="Change profile picture">
            <View>
              <Avatar name={user.name} uri={avatar?.uri || user.profilePicture} size={72} />
              {saving && avatar ? (
                <View style={{
                  position: "absolute", left: 0, top: 0, width: 72, height: 72, borderRadius: 36,
                  backgroundColor: C.overlay, alignItems: "center", justifyContent: "center",
                }}>
                  <ActivityIndicator color={C.onPrimary} />
                </View>
              ) : null}
              <View style={{
                position: "absolute", right: -2, bottom: -2,
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: C.primary, borderWidth: 2, borderColor: C.surface,
                alignItems: "center", justifyContent: "center",
              }}>
                <Camera color={C.onPrimary} size={13} />
              </View>
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.heading, fontWeight: "800", fontSize: 18 }}>{user.name}</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{user.email}</Text>
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Student</Text>
          </View>
        </View>
        <View style={{ marginTop: 10 }}>
          <Row label="Program" value={user.program} C={C} />
          <Row label="Roll number" value={user.rollNumber} C={C} />
          <Row label="Session" value={user.session ? user.session.toUpperCase() : null} C={C} />
          <Row label="Admission year" value={user.admissionYear} C={C} />
        </View>
      </Card>

      <Pressable onPress={() => navigation.navigate("MyQuestions")} accessibilityRole="button"
        style={{ marginTop: 12 }}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}>
          <HelpCircle color={C.primary} size={20} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.heading, fontWeight: "700", fontSize: 14 }}>My questions</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              Questions you sent to the university admin and their answers
            </Text>
          </View>
          <ChevronRight color={C.muted} size={18} />
        </Card>
      </Pressable>

      <Card style={{ marginTop: 12 }}>
        <Text style={{ color: C.heading, fontWeight: "700", fontSize: 14, marginBottom: 12 }}>Profile</Text>
        <Input label="Display name" value={name} onChangeText={setName} maxLength={80} />
        <Text style={{ color: C.muted, fontSize: 11, marginBottom: 12 }}>
          {avatar ? "New picture selected. Save to upload it." : "Tap your picture to change it (JPG, PNG, GIF or WebP, max 2MB)."}
        </Text>
        <Button title="Save changes" onPress={onSave} loading={saving} loadingTitle={saveLabel} disabled={!dirty} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={{ color: C.heading, fontWeight: "700", fontSize: 14, marginBottom: 12 }}>Change password</Text>
        <Input label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        <Input label="New password (min 6)" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        <Input label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <Button title="Update password" onPress={onChangePassword} loading={changingPw} loadingTitle="Updating…" />
      </Card>

      <Button
        title={`Theme: ${isDark ? "Dark" : "Light"}`}
        onPress={() => dispatch(toggleTheme())}
        variant="secondary"
        icon={isDark ? <Sun color={C.label} size={16} /> : <Moon color={C.label} size={16} />}
        style={{ marginTop: 14 }}
      />
      <Button title="Sign out" onPress={onLogout} variant="danger" icon={<LogOut color={C.danger} size={16} />}
        style={{ marginTop: 10 }} />
    </ScrollView>
  );
}
