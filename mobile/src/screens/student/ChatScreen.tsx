import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, FlatList, KeyboardAvoidingView, Platform, Pressable, Alert,
  ActivityIndicator,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Send, Mic, Square, X, HelpCircle, Check, Flag } from "lucide-react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useTheme } from "../../hooks/useTheme";
import { useElapsed } from "../../hooks/useElapsed";
import {
  loadChat, sendMessage, messageKey, isEscalated, type ChatMessage,
} from "../../redux/slices/chatSlice";
import { apiTranscribe, type ChatMode } from "../../api/chat";
import { errorMessage } from "../../api/client";
import { apiAskAdmin, MAX_QUESTION_CHARS } from "../../api/question";
import { FilterChip } from "../../components/FilterChip";
import { TypingIndicator } from "../../components/TypingIndicator";
import { ComplaintSheet, type ComplaintResult } from "../../components/ComplaintSheet";
import { fetchMyIssues } from "../../redux/slices/issueSlice";
import type { AppDispatch, RootState } from "../../redux/store";

const MAX_PROMPT_CHARS = 4000;
const MAX_RECORDING_SECONDS = 30;
const MIN_RECORDING_SECONDS = 2;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const SUGGESTIONS = [
  "What is the fee structure?",
  "In which areas does MAJU offer degrees?",
  "Does MAJU offer any scholarships?",
];

type RecState = "idle" | "recording" | "transcribing";
type AskState = { status: "sending" | "sent" | "error"; message?: string };

const ESCALATED_NOTE =
  "I couldn't answer this — it has been sent to the university admin. You'll be notified when they reply.";

// The user question an assistant reply at `index` answered.
const precedingQuestion = (messages: ChatMessage[], index: number): string | null => {
  for (let i = index - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content?.trim() || null;
  }
  return null;
};

// Stop and release a recording; safe to call on one that already stopped.
const releaseRecording = async (rec: Audio.Recording) => {
  try { await rec.stopAndUnloadAsync(); } catch { /* already unloaded */ }
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
};

const deleteFile = (uri?: string | null) => {
  if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
};

export default function ChatScreen({ route, navigation }: any) {
  const chatId: string = route.params?.id;
  const { C } = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const chat = useSelector((s: RootState) => s.chat.chats.find((c) => c._id === chatId));
  // When this chat's reply wait started; other chats can be waiting too.
  const pendingSince = useSelector((s: RootState) => s.chat.pending[chatId]);
  const pending = !!pendingSince;

  const [text, setText] = useState("");
  const [mode, setMode] = useState<ChatMode>("text");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recState, setRecState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [transcribeStart, setTranscribeStart] = useState<number | null>(null);
  const transcribeSeconds = useElapsed(transcribeStart);
  // "Ask an admin" state per assistant message, keyed like the list items.
  const [asks, setAsks] = useState<Record<string, AskState>>({});
  // "Register a complaint": the message whose sheet is open, and the outcome
  // per assistant message (same keys as `asks`).
  const [complaintFor, setComplaintFor] = useState<{ key: string; question: string | null } | null>(null);
  const [complaints, setComplaints] = useState<Record<string, ComplaintResult>>({});
  const listExtra = useMemo(() => ({ asks, complaints }), [asks, complaints]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const reload = () => {
    setLoadError(null);
    dispatch(loadChat(chatId)).then((r) => {
      if (loadChat.rejected.match(r) && mountedRef.current) setLoadError(r.payload as string);
    });
  };

  useEffect(() => { if (chatId) reload(); /* eslint-disable-next-line */ }, [chatId]);

  useEffect(() => {
    navigation.setOptions({ title: chat?.name || "Chat" });
  }, [navigation, chat?.name]);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Leaving the screen mid-recording must release the microphone.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      const rec = recordingRef.current;
      recordingRef.current = null;
      if (rec) releaseRecording(rec).then(() => deleteFile(rec.getURI()));
    };
  }, []);

  const startRec = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return Alert.alert("Microphone permission is required");
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      if (!mountedRef.current) {
        await releaseRecording(recording);
        deleteFile(recording.getURI());
        return;
      }
      recordingRef.current = recording;
      setSeconds(0);
      setRecState("recording");
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      Alert.alert("Couldn't start recording", e?.message || "Try again");
    }
  };

  // Transcribe-only, like the web app: the text is added to the input so the
  // user can review/edit it before sending.
  const stopRec = async (transcribe: boolean) => {
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    clearTimer();
    const duration = seconds;
    setRecState(transcribe ? "transcribing" : "idle");
    await releaseRecording(rec);
    const uri = rec.getURI();
    if (!transcribe || !uri) {
      deleteFile(uri);
      return;
    }
    try {
      if (duration < MIN_RECORDING_SECONDS) {
        Alert.alert("Recording too short", `Speak for at least ${MIN_RECORDING_SECONDS} seconds.`);
        return;
      }
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && info.size > MAX_AUDIO_BYTES) {
        Alert.alert("Recording too large", "Voice messages can be at most 5MB.");
        return;
      }
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      setTranscribeStart(Date.now());
      // expo-av's HIGH_QUALITY preset records AAC in an .m4a container on both platforms.
      const size = info.exists ? info.size : Math.floor((b64.length * 3) / 4);
      const { data } = await apiTranscribe(`data:audio/m4a;base64,${b64}`, duration, size);
      if (!mountedRef.current) return;
      const heard = String(data?.transcription || "").trim();
      if (heard) {
        // Added after anything already typed instead of replacing it.
        setText((t) => (t.trim() ? `${t.trimEnd()} ${heard}` : heard).slice(0, MAX_PROMPT_CHARS));
      } else {
        Alert.alert("No speech detected", "Please speak clearly and try again.");
      }
    } catch (e) {
      if (mountedRef.current) Alert.alert("Transcription failed", errorMessage(e, "Try again or type your message."));
    } finally {
      deleteFile(uri);
      if (mountedRef.current) {
        setTranscribeStart(null);
        setRecState("idle");
      }
    }
  };

  useEffect(() => {
    if (recState === "recording" && seconds >= MAX_RECORDING_SECONDS) {
      stopRec(true);
      Alert.alert("Recording stopped", `Voice messages are limited to ${MAX_RECORDING_SECONDS} seconds.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, recState]);

  const onSend = async (override?: string) => {
    const prompt = (override ?? text).trim();
    if (!prompt || !chat || pending) return;
    if (prompt.length > MAX_PROMPT_CHARS) {
      return Alert.alert(`Message is too long (max ${MAX_PROMPT_CHARS} characters)`);
    }
    setText("");
    const r = await dispatch(sendMessage({ chatId, prompt, mode, localId: `local-${Date.now()}` }));
    if (sendMessage.rejected.match(r)) {
      Alert.alert("Message not sent", (r.payload as string) || "Try again");
      if (mountedRef.current) setText((t) => t || prompt);
    }
  };

  const askAdmin = async (key: string, question: string) => {
    if (asks[key]?.status === "sending" || asks[key]?.status === "sent") return;
    setAsks((a) => ({ ...a, [key]: { status: "sending" } }));
    try {
      await apiAskAdmin(question.slice(0, MAX_QUESTION_CHARS), chatId);
      if (mountedRef.current) setAsks((a) => ({ ...a, [key]: { status: "sent" } }));
    } catch (e: any) {
      const message = e?.response?.status === 429
        ? e.response.data?.message || "You've sent too many questions. Please try again later."
        : errorMessage(e, "Couldn't send it to the admin. Try again.");
      if (mountedRef.current) setAsks((a) => ({ ...a, [key]: { status: "error", message } }));
    }
  };

  const onComplaintDone = (r: ComplaintResult) => {
    const key = complaintFor?.key;
    setComplaintFor(null);
    if (key) setComplaints((c) => ({ ...c, [key]: r }));
    if (r.status === "filed") dispatch(fetchMyIssues());
  };

  const openMyIssues = () => navigation.navigate("StudentTabs", { screen: "Issues" });

  if (!chat) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg, padding: 24 }}>
        {loadError ? (
          <>
            <Text style={{ color: C.text, marginBottom: 12, textAlign: "center" }}>{loadError}</Text>
            <Pressable onPress={reload}><Text style={{ color: C.navy, fontWeight: "600" }}>Retry</Text></Pressable>
          </>
        ) : (
          <ActivityIndicator color={C.navy} />
        )}
      </View>
    );
  }

  const busy = recState !== "idle";
  const canSend = !!text.trim() && !pending && !busy;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      <FlatList
        ref={listRef}
        data={chat.messages}
        keyExtractor={messageKey}
        extraData={listExtra}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item, index }) => {
          const mine = item.role === "user";
          const key = messageKey(item, index);
          const question = !mine && item.role === "assistant" ? precedingQuestion(chat.messages, index) : null;
          const escalated = isEscalated(item);
          const ask = asks[key] || (escalated ? { status: "sent" as const } : undefined);
          const complaint = complaints[key];
          return (
            <View>
              <View
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  backgroundColor: mine ? C.bubbleUser : C.surface,
                  borderColor: C.border, borderWidth: mine ? 0 : 1,
                  padding: 10, borderRadius: 12, marginVertical: 4, marginHorizontal: 12, maxWidth: "85%",
                  opacity: item.sending ? 0.7 : 1,
                }}
              >
                {item.type === "voice" || item.type === "email" ? (
                  <Text style={{ color: mine ? C.onBubbleUser : C.muted, fontSize: 10, marginBottom: 2 }}>
                    {item.type === "voice" ? "Voice" : "Email draft"}
                  </Text>
                ) : null}
                <Text selectable style={{ color: mine ? C.onBubbleUser : C.text }}>{item.content}</Text>
                {escalated ? (
                  <Text style={{
                    color: C.muted, fontSize: 12, fontStyle: "italic", marginTop: 8, paddingTop: 8,
                    borderTopWidth: 1, borderTopColor: C.border,
                  }}>
                    {ESCALATED_NOTE}
                  </Text>
                ) : null}
              </View>
              {question ? (
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginHorizontal: 16, marginBottom: 4 }}>
                  {ask?.status === "sent" ? (
                    <>
                      <Check color={C.green} size={12} />
                      <Text style={{ color: C.green, fontSize: 11, fontWeight: "600" }}>Sent to admin</Text>
                      <Pressable onPress={() => navigation.navigate("MyQuestions")} hitSlop={6}>
                        <Text style={{ color: C.navy, fontSize: 11 }}>· My questions</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable onPress={() => askAdmin(key, question)} disabled={ask?.status === "sending"} hitSlop={6}
                        accessibilityRole="button" accessibilityLabel="Ask an admin"
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: ask?.status === "sending" ? 0.6 : 1 }}>
                        {ask?.status === "sending"
                          ? <ActivityIndicator size="small" color={C.muted} />
                          : <HelpCircle color={C.muted} size={12} />}
                        <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600" }}>
                          {ask?.status === "sending" ? "Sending…" : ask?.status === "error" ? "Retry: ask an admin" : "Ask an admin"}
                        </Text>
                      </Pressable>
                      {ask?.status === "error" ? (
                        <Text style={{ color: C.red, fontSize: 11, flexShrink: 1 }}>{ask.message}</Text>
                      ) : null}
                    </>
                  )}
                  {!complaint && !item.suggestComplaint ? (
                    <>
                      <Text style={{ color: C.border, fontSize: 11 }}>|</Text>
                      <Pressable onPress={() => setComplaintFor({ key, question })} hitSlop={6}
                        accessibilityRole="button" accessibilityLabel="Register a complaint"
                        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Flag color={C.muted} size={12} />
                        <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600" }}>Register a complaint</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              ) : null}
              {question && complaint ? (
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginHorizontal: 16, marginBottom: 4 }}>
                  {complaint.status === "filed" ? (
                    <>
                      <Check color={C.green} size={12} />
                      <Text style={{ color: C.green, fontSize: 11, fontWeight: "600", flexShrink: 1 }}>
                        Complaint registered with {complaint.dept}
                      </Text>
                      <Pressable onPress={openMyIssues} hitSlop={6}>
                        <Text style={{ color: C.navy, fontSize: 11 }}>· Track it in My Issues</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={{ color: C.amber, fontSize: 11, flexShrink: 1 }}>{complaint.message}</Text>
                      <Pressable hitSlop={6}
                        onPress={() => complaint.issueId
                          ? navigation.navigate("IssueDetail", { id: complaint.issueId })
                          : openMyIssues()}>
                        <Text style={{ color: C.navy, fontSize: 11 }}>· View issue</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ) : null}
              {question && !complaint && item.suggestComplaint ? (
                <Pressable onPress={() => setComplaintFor({ key, question })}
                  accessibilityRole="button" accessibilityLabel="Register a complaint"
                  style={({ pressed }) => ({
                    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start",
                    marginHorizontal: 12, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 7,
                    borderRadius: 10, borderWidth: 1, borderColor: C.amber, backgroundColor: `${C.amber}1A`,
                    opacity: pressed ? 0.8 : 1, maxWidth: "85%",
                  })}>
                  <Flag color={C.amber} size={14} />
                  <Text style={{ color: C.text, fontSize: 12, flexShrink: 1 }}>
                    Is this a complaint? <Text style={{ color: C.navy, fontWeight: "700" }}>Register it with the department</Text>
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ padding: 20, alignItems: "center" }}>
            <Text style={{ color: C.muted, textAlign: "center", marginBottom: 12 }}>
              Ask anything about MAJU.
            </Text>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} onPress={() => onSend(s)} disabled={pending}
                style={{
                  borderColor: C.border, borderWidth: 1, borderRadius: 10, paddingVertical: 8,
                  paddingHorizontal: 12, marginBottom: 8, backgroundColor: C.surface,
                }}>
                <Text style={{ color: C.text, fontSize: 13 }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        }
        ListFooterComponent={pendingSince ? <TypingIndicator startedAt={pendingSince} /> : null}
        contentContainerStyle={{ paddingVertical: 14 }}
      />

      <View style={{
        backgroundColor: C.surface, borderTopColor: C.border, borderTopWidth: 1,
        paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10 + insets.bottom,
      }}>
        <View style={{ flexDirection: "row", marginBottom: 6 }}>
          <FilterChip label="Ask" active={mode === "text"} onPress={() => setMode("text")} />
          <FilterChip label="Draft email" active={mode === "email"} onPress={() => setMode("email")} />
        </View>
        {recState === "recording" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable onPress={() => stopRec(false)} accessibilityLabel="Cancel recording"
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceAlt }}>
              <X color={C.text} size={18} />
            </Pressable>
            <Text style={{ flex: 1, color: C.red, fontWeight: "600" }}>
              Recording… {seconds}s / {MAX_RECORDING_SECONDS}s
            </Text>
            <Pressable onPress={() => stopRec(true)} accessibilityLabel="Stop and transcribe"
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.red }}>
              <Square color="#fff" size={16} />
            </Pressable>
          </View>
        ) : (
          <>
            {recState === "transcribing" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}
                accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={C.muted} />
                <Text style={{ color: C.muted, fontSize: 12 }}>
                  Transcribing your voice…{transcribeStart ? ` ${transcribeSeconds} s` : ""}
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
              <Pressable onPress={startRec} disabled={busy || pending} accessibilityLabel="Record voice message"
                style={{
                  width: 44, height: 44, borderRadius: 22, backgroundColor: C.surfaceAlt,
                  alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border,
                  opacity: busy || pending ? 0.5 : 1,
                }}>
                {recState === "transcribing" ? <ActivityIndicator size="small" color={C.text} /> : <Mic color={C.text} size={18} />}
              </Pressable>
              <TextInput
                value={text} onChangeText={setText} multiline maxLength={MAX_PROMPT_CHARS}
                editable={recState !== "transcribing"}
                placeholder={
                  recState === "transcribing" ? "Transcribing…"
                    : mode === "email" ? "Describe the email you need…" : "Type a message…"
                }
                placeholderTextColor={C.muted}
                style={{
                  flex: 1, backgroundColor: C.input, color: C.text, maxHeight: 120,
                  borderColor: C.border, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10,
                }}
              />
              <Pressable onPress={() => onSend()} disabled={!canSend}
                accessibilityRole="button" accessibilityLabel="Send message"
                accessibilityState={{ disabled: !canSend }}
                style={{
                  width: 44, height: 44, borderRadius: 22, backgroundColor: C.navy,
                  alignItems: "center", justifyContent: "center", opacity: canSend ? 1 : 0.5,
                }}>
                <Send color={C.onNavy} size={18} />
              </Pressable>
            </View>
          </>
        )}
      </View>
      <ComplaintSheet visible={!!complaintFor} chatId={chatId} question={complaintFor?.question ?? null}
        onClose={() => setComplaintFor(null)} onDone={onComplaintDone} />
    </KeyboardAvoidingView>
  );
}
