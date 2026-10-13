import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable,
} from "react-native";
import { useDispatch } from "react-redux";
import { useHeaderHeight } from "@react-navigation/elements";
import moment from "moment";
import { useTheme } from "../../hooks/useTheme";
import { useFocusPolling } from "../../hooks/useFocusPolling";
import { apiGetIssue, apiStudentReply, apiIssueFeedback, MAX_FEEDBACK_CHARS } from "../../api/issue";
import { errorMessage } from "../../api/client";
import { fetchMyIssues } from "../../redux/slices/issueSlice";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import {
  StatusPill, Attachments, ReplyList, StarRating, FeedbackView,
} from "../../components/IssueParts";
import type { AppDispatch } from "../../redux/store";

const MAX_REPLY_CHARS = 5000;
const RATING_LABELS = ["", "Very poor", "Poor", "Okay", "Good", "Excellent"];

export default function IssueDetailScreen({ route }: any) {
  const id: string = route.params?.id;
  const { C } = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const headerHeight = useHeaderHeight();
  const [issue, setIssue] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [ratingSending, setRatingSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiGetIssue(id);
      setIssue(data.issue);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "Couldn't load this issue"));
    }
  }, [id]);

  // A different id (e.g. opened from a notification) must not show the old issue.
  useEffect(() => { setIssue(null); setError(null); }, [id]);
  useFocusPolling(load, 20000);

  const onReply = async () => {
    const message = reply.trim();
    if (!message) return;
    if (message.length > MAX_REPLY_CHARS) return Alert.alert(`Reply must be at most ${MAX_REPLY_CHARS} characters`);
    setSending(true);
    try {
      const { data } = await apiStudentReply(id, message);
      if (data?.issue) setIssue(data.issue);
      setReply("");
      dispatch(fetchMyIssues());
    } catch (e) {
      Alert.alert("Reply not sent", errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const onFeedback = async () => {
    if (rating < 1) return;
    setRatingSending(true);
    try {
      const c = comment.trim();
      const { data } = await apiIssueFeedback(id, { rating, ...(c ? { comment: c } : {}) });
      if (data?.issue) setIssue(data.issue);
      else load();
      setRating(0);
      setComment("");
    } catch (e: any) {
      // 409: already rated (e.g. from the web) — show what's stored.
      if (e?.response?.status === 409) load();
      Alert.alert("Feedback not sent", errorMessage(e));
    } finally {
      setRatingSending(false);
    }
  };

  if (!issue) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg, padding: 24 }}>
        {error ? (
          <>
            <Text style={{ color: C.text, textAlign: "center", marginBottom: 12 }}>{error}</Text>
            <Pressable onPress={load}><Text style={{ color: C.navy, fontWeight: "600" }}>Retry</Text></Pressable>
          </>
        ) : <ActivityIndicator color={C.navy} />}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 18 }}>{issue.title}</Text>
          <Text style={{ color: C.muted, marginTop: 4, fontSize: 12 }}>
            {[issue.department?.code && `${issue.department.code} — ${issue.department.name}`,
              issue.category && `Category: ${issue.category}`,
              moment(issue.createdAt).format("MMM D, YYYY h:mm A")].filter(Boolean).join(" · ")}
          </Text>
          <View style={{ marginTop: 10 }}><StatusPill status={issue.status} /></View>
          {issue.status === "Rejected" && issue.rejectionReason ? (
            <Text style={{ color: C.red, marginTop: 8, fontSize: 13 }}>
              Rejection reason: {issue.rejectionReason}
            </Text>
          ) : null}
          <Text selectable style={{ color: C.text, marginTop: 12 }}>{issue.description}</Text>
          <Attachments items={issue.attachments} />
        </Card>

        {issue.status === "Resolved" || issue.status === "Closed" ? (
          issue.feedback?.rating ? (
            <FeedbackView feedback={issue.feedback} title="Your feedback" />
          ) : (
            <Card style={{ marginTop: 12 }}>
              <Text style={{ color: C.text, fontWeight: "700" }}>How was this handled?</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 2, marginBottom: 10 }}>
                Rate the department's response. You can only rate once.
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <StarRating value={rating} onChange={setRating} size={28} />
                {rating ? <Text style={{ color: C.muted, fontSize: 12 }}>{RATING_LABELS[rating]}</Text> : null}
              </View>
              <TextInput value={comment} onChangeText={setComment} multiline maxLength={MAX_FEEDBACK_CHARS}
                placeholder="Comment (optional)" placeholderTextColor={C.muted}
                style={{
                  backgroundColor: C.input, color: C.text, borderColor: C.border, borderWidth: 1,
                  borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 10, minHeight: 70, textAlignVertical: "top",
                }} />
              <Button title="Submit feedback" onPress={onFeedback} loading={ratingSending} loadingTitle="Sending…"
                disabled={rating < 1} />
            </Card>
          )
        ) : null}

        <Text style={{ color: C.text, fontWeight: "700", fontSize: 15, marginTop: 18, marginBottom: 8 }}>Replies</Text>
        <ReplyList replies={issue.replies} emptyText="No replies yet. Staff updates appear here." />

        {issue.status !== "Closed" ? (
          <>
            <TextInput value={reply} onChangeText={setReply} multiline maxLength={MAX_REPLY_CHARS}
              placeholder="Add a follow-up reply…" placeholderTextColor={C.muted}
              style={{
                backgroundColor: C.input, color: C.text, borderColor: C.border, borderWidth: 1,
                borderRadius: 10, padding: 12, marginTop: 14, marginBottom: 10, minHeight: 90, textAlignVertical: "top",
              }} />
            <Button title="Send reply" onPress={onReply} loading={sending} loadingTitle="Sending…" disabled={!reply.trim()} />
          </>
        ) : (
          <Text style={{ color: C.muted, marginTop: 14 }}>This issue is closed.</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
