import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Alert, ActivityIndicator, Pressable } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import NetInfo from "@react-native-community/netinfo";
import * as DocumentPicker from "expo-document-picker";
import { Paperclip, X } from "lucide-react-native";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { FilterChip } from "../../components/FilterChip";
import { useTheme } from "../../hooks/useTheme";
import { apiCreateIssue, apiListDepartments } from "../../api/issue";
import { errorMessage } from "../../api/client";
import { fetchMyIssues } from "../../redux/slices/issueSlice";
import { enqueue } from "../../redux/slices/outboxSlice";
import type { AppDispatch, RootState } from "../../redux/store";

// Same list as the web form; the server lowercases whatever it receives.
const CATEGORIES = ["finance", "academics", "IT", "administrative", "hostel", "library", "other"];
const MAX_TITLE_CHARS = 200;
const MAX_DESCRIPTION_CHARS = 5000;
const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Exactly what the server accepts (no SVG, no HEIC).
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
const EXT_TYPES: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
};

interface Attachment { uri: string; name: string; type: string; size?: number }

export default function NewIssueScreen({ navigation }: any) {
  const { C } = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((s: RootState) => s.auth.user?._id);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [departments, setDepartments] = useState<any[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadDepartments = async () => {
    setDeptLoading(true);
    setDeptError(null);
    try {
      const { data } = await apiListDepartments();
      const list = (data?.departments || []).filter((d: any) => d.isActive !== false);
      setDepartments(list);
      setDepartmentId((cur) => cur || list[0]?._id || "");
    } catch (e) {
      setDeptError(errorMessage(e, "Couldn't load departments"));
    } finally {
      setDeptLoading(false);
    }
  };

  useEffect(() => { loadDepartments(); }, []);

  const pickFiles = async () => {
    if (files.length >= MAX_FILES) return Alert.alert(`Max ${MAX_FILES} files`);
    const r = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_TYPES, multiple: true, copyToCacheDirectory: true,
    });
    if (r.canceled || !r.assets?.length) return;
    const next = [...files];
    const skipped: string[] = [];
    for (const a of r.assets) {
      const ext = a.name.split(".").pop()?.toLowerCase() || "";
      const type = (a.mimeType && ALLOWED_TYPES.includes(a.mimeType) ? a.mimeType : EXT_TYPES[ext]) || "";
      if (!type) { skipped.push(`${a.name}: only PDF, JPG, PNG, GIF or WebP`); continue; }
      if (a.size && a.size > MAX_FILE_BYTES) { skipped.push(`${a.name}: larger than 5MB`); continue; }
      if (next.length >= MAX_FILES) { skipped.push(`${a.name}: max ${MAX_FILES} files`); continue; }
      next.push({ uri: a.uri, name: a.name, type, size: a.size });
    }
    setFiles(next);
    if (skipped.length) Alert.alert("Some files were skipped", skipped.join("\n"));
  };

  const onSubmit = async () => {
    const t = title.trim();
    const d = description.trim();
    if (!t || !d || !departmentId) return Alert.alert("Title, description and department are required");
    if (t.length > MAX_TITLE_CHARS) return Alert.alert(`Title must be at most ${MAX_TITLE_CHARS} characters`);
    if (d.length > MAX_DESCRIPTION_CHARS) {
      return Alert.alert(`Description must be at most ${MAX_DESCRIPTION_CHARS} characters`);
    }
    setSubmitting(true);

    const net = await NetInfo.fetch();
    if (!net.isConnected || net.isInternetReachable === false) {
      setSubmitting(false);
      if (!userId) return Alert.alert("You're offline", "Try again when you're online.");
      if (files.length) {
        return Alert.alert("You're offline", "Issues with attachments can't be queued. Remove the attachments or try again when you're online.");
      }
      dispatch(enqueue({
        id: `local-${Date.now()}`,
        kind: "issue",
        userId,
        payload: { title: t, description: d, category, departmentId },
        createdAt: new Date().toISOString(),
      }));
      Alert.alert("Saved offline", "It will be sent as soon as you're back online.");
      navigation.goBack();
      return;
    }

    const form = new FormData();
    form.append("title", t);
    form.append("description", d);
    form.append("category", category);
    form.append("departmentId", departmentId);
    // RN's FormData takes { uri, name, type } in place of a Blob.
    files.forEach((f) => form.append("attachments", { uri: f.uri, name: f.name, type: f.type } as any));
    try {
      const { data } = await apiCreateIssue(form);
      dispatch(fetchMyIssues());
      if (data?.issue?._id) navigation.replace("IssueDetail", { id: data.issue._id });
      else navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't submit", errorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled">
      <Input label="Title" value={title} onChangeText={setTitle} maxLength={MAX_TITLE_CHARS} placeholder="Short summary" />

      <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginBottom: 6, textTransform: "uppercase" }}>Department</Text>
      {deptLoading ? (
        <ActivityIndicator style={{ alignSelf: "flex-start", marginBottom: 14 }} color={C.navy} />
      ) : deptError ? (
        <Pressable onPress={loadDepartments} style={{ marginBottom: 14 }}>
          <Text style={{ color: C.red }}>{deptError}. Tap to retry.</Text>
        </Pressable>
      ) : departments.length === 0 ? (
        <Text style={{ color: C.muted, marginBottom: 14 }}>
          No departments are set up yet — please contact the administration.
        </Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          {departments.map((d) => (
            <FilterChip key={d._id} label={d.code ? `${d.code} · ${d.name}` : d.name}
              active={departmentId === d._id} onPress={() => setDepartmentId(d._id)} />
          ))}
        </View>
      )}

      <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginBottom: 6, textTransform: "uppercase" }}>Category</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
        {CATEGORIES.map((c) => (
          <FilterChip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>

      <Input label="Description" value={description} onChangeText={setDescription} multiline
        maxLength={MAX_DESCRIPTION_CHARS} placeholder="Describe the issue in detail."
        style={{ height: 140, textAlignVertical: "top" }} />

      <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginBottom: 6, textTransform: "uppercase" }}>
        Attachments (optional)
      </Text>
      <Text style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>
        PDF, JPG, PNG, GIF or WebP. Max {MAX_FILES} files, 5MB each.
      </Text>
      {files.map((f) => (
        <View key={f.uri} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Paperclip color={C.muted} size={13} />
          <Text style={{ color: C.text, fontSize: 12, flex: 1 }} numberOfLines={1}>
            {f.name}{f.size ? ` (${Math.round(f.size / 1024)} KB)` : ""}
          </Text>
          <Pressable onPress={() => setFiles((l) => l.filter((x) => x.uri !== f.uri))} accessibilityLabel={`Remove ${f.name}`}>
            <X color={C.red} size={16} />
          </Pressable>
        </View>
      ))}
      {files.length < MAX_FILES && (
        <Button title="Add files" variant="secondary" onPress={pickFiles}
          icon={<Paperclip color={C.text} size={14} />} style={{ alignSelf: "flex-start", marginBottom: 16 }} />
      )}

      {deptLoading || deptError || departments.length > 0 ? (
        <Button title="Submit issue" onPress={onSubmit} loading={submitting}
          loadingTitle={files.length ? "Uploading & registering…" : "Registering…"}
          disabled={deptLoading || !departmentId} style={{ marginTop: 8 }} />
      ) : null}
    </ScrollView>
  );
}
