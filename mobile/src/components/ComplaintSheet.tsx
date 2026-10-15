import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { X, Sparkles } from "lucide-react-native";
import { useTheme } from "../hooks/useTheme";
import {
  apiListDepartments, apiDepartmentSuggestion, apiIssueFromChat, MAX_COMPLAINT_DETAILS_CHARS,
} from "../api/issue";
import { errorMessage } from "../api/client";
import { Button } from "./Button";
import { FilterChip } from "./FilterChip";

export type ComplaintResult =
  // Filed now, or this chat already had an open complaint (409).
  | { status: "filed"; issueId?: string; dept: string }
  | { status: "exists"; issueId?: string; message: string };

const deptLabel = (d: any) => (d?.code ? `${d.code} · ${d.name}` : d?.name || "");

// "Register a complaint" bottom sheet for one chat: department (pre-selected
// from the server's suggestion for `question`), optional details, submit to
// POST /api/issue/from-chat. The server attaches the chat transcript.
export const ComplaintSheet: React.FC<{
  visible: boolean;
  chatId: string;
  question: string | null;
  onClose: () => void;
  onDone: (r: ComplaintResult) => void;
}> = ({ visible, chatId, question, onClose, onDone }) => {
  const { C } = useTheme();
  const [departments, setDepartments] = useState<any[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [suggestedId, setSuggestedId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A sheet reopened for another message drops the older load's results.
  const loadRef = useRef(0);

  const load = async () => {
    const req = ++loadRef.current;
    setDeptLoading(true);
    setDeptError(null);
    const [depts, suggestion] = await Promise.allSettled([
      apiListDepartments(),
      question ? apiDepartmentSuggestion(question.slice(0, 2000)) : Promise.resolve(null),
    ]);
    if (req !== loadRef.current) return;
    if (depts.status === "rejected") {
      setDeptError(errorMessage(depts.reason, "Couldn't load departments"));
      setDeptLoading(false);
      return;
    }
    const list = (depts.value?.data?.departments || []).filter((d: any) => d.isActive !== false);
    // The suggestion is only a default; a failed lookup just leaves it unset.
    const suggested =
      suggestion.status === "fulfilled" ? (suggestion.value as any)?.data?.suggestion?.departmentId : null;
    const match = suggested && list.some((d: any) => d._id === suggested) ? String(suggested) : null;
    setDepartments(list);
    setSuggestedId(match);
    setDepartmentId(match || "");
    setDeptLoading(false);
  };

  useEffect(() => {
    if (!visible) return;
    setDetails("");
    setError(null);
    setSubmitting(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, question]);

  // The sheet stays open while the complaint is being registered, so the
  // result can't get lost.
  const close = () => {
    if (!submitting) onClose();
  };

  const submit = async () => {
    if (!departmentId || submitting) return;
    setSubmitting(true);
    setError(null);
    const d = details.trim();
    try {
      const { data } = await apiIssueFromChat({ chatId, departmentId, ...(d ? { details: d } : {}) });
      const dept = data?.issue?.department?.code || departments.find((x) => x._id === departmentId)?.code
        || departments.find((x) => x._id === departmentId)?.name || "the department";
      onDone({ status: "filed", issueId: data?.issue?._id, dept });
    } catch (e: any) {
      const body = e?.response?.data;
      if (e?.response?.status === 409) {
        onDone({
          status: "exists",
          issueId: body?.issue?._id,
          message: body?.message || "You already registered a complaint from this chat",
        });
      } else {
        setError(
          e?.response?.status === 429
            ? body?.message || "You've registered too many complaints. Please try again later."
            : errorMessage(e, "Couldn't register the complaint. Try again.")
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: C.overlay }}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" />
        <View style={{
          backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
          padding: 18, maxHeight: "85%",
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: C.heading, fontWeight: "800", fontSize: 16 }}>Register a complaint</Text>
            <Pressable onPress={close} disabled={submitting} hitSlop={8} accessibilityLabel="Cancel"
              style={{ opacity: submitting ? 0.4 : 1 }}>
              <X color={C.muted} size={22} />
            </Pressable>
          </View>
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 4, marginBottom: 12 }}>
            It goes to the department's staff as an issue you can track in My Issues.
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginBottom: 6, textTransform: "uppercase" }}>
              Department
            </Text>
            {deptLoading ? (
              <ActivityIndicator style={{ alignSelf: "flex-start", marginBottom: 14 }} color={C.primary} />
            ) : deptError ? (
              <Pressable onPress={load} style={{ marginBottom: 14 }}>
                <Text style={{ color: C.danger }}>{deptError}. Tap to retry.</Text>
              </Pressable>
            ) : departments.length === 0 ? (
              <Text style={{ color: C.muted, marginBottom: 14 }}>
                No departments are set up yet — please contact the administration.
              </Text>
            ) : (
              <>
                {suggestedId ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 }}>
                    <Sparkles color={C.link} size={12} />
                    <Text style={{ color: C.link, fontSize: 11 }}>Suggested from your question — change it if needed.</Text>
                  </View>
                ) : (
                  <Text style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>Pick the department this is about.</Text>
                )}
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
                  {departments.map((d) => (
                    <FilterChip key={d._id} label={deptLabel(d)}
                      active={departmentId === d._id} onPress={() => setDepartmentId(d._id)} />
                  ))}
                </View>
              </>
            )}

            <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginBottom: 6, textTransform: "uppercase" }}>
              Details (optional)
            </Text>
            <TextInput value={details} onChangeText={setDetails} multiline maxLength={MAX_COMPLAINT_DETAILS_CHARS}
              editable={!submitting}
              placeholder="Anything the department should know" placeholderTextColor={C.placeholder}
              style={{
                backgroundColor: C.inputBg, color: C.text, borderColor: C.inputBorder, borderWidth: 1,
                borderRadius: 12, padding: 12, minHeight: 90, textAlignVertical: "top",
              }} />
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>The chat transcript is attached automatically.</Text>

            {error ? <Text style={{ color: C.danger, fontSize: 12, marginTop: 10 }}>{error}</Text> : null}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Button title="Cancel" variant="ghost" onPress={close} disabled={submitting} style={{ flex: 1 }} />
              {deptLoading || deptError || departments.length > 0 ? (
                <Button title="Submit" onPress={submit} loading={submitting} loadingTitle="Registering…"
                  disabled={deptLoading || !departmentId} style={{ flex: 1.4 }} />
              ) : null}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
