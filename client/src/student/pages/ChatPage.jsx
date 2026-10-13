import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "../../utils/axios";
import { appendMessages } from "../../redux/slices/chatSlice";
import { askAdmin } from "../../redux/slices/questionSlice";
import Message from "../components/Message";
import ChatComposer from "../components/ChatComposer";
import ChatWaitIndicator from "../../components/ChatWaitIndicator";
import toast from "react-hot-toast";
import { MessageSquare, Sparkles } from "lucide-react";

const MAX_QUESTION_CHARS = 2000;
const EMPTY = [];

// The user question each assistant message replied to (by index), so every
// Message gets a plain string prop instead of a lookup closure.
const questionsByIndex = (messages) => {
  const out = new Array(messages.length).fill("");
  let last = "";
  messages.forEach((m, i) => {
    if (m?.role === "user") {
      if (!m.isImage && typeof m.content === "string" && m.content.trim()) last = m.content.trim();
    } else {
      out[i] = last;
    }
  });
  return out;
};

const ChatPage = () => {
  const dispatch = useDispatch();
  const containRef = useRef(null);
  const selectedChat = useSelector((s) => s.chat.selectedChat);
  const theme = useSelector((s) => s.theme.theme);
  const user = useSelector((s) => s.auth.user);
  const token = useSelector((s) => s.auth.token);
  const isDark = theme === "dark";
  const chatId = selectedChat?._id;

  // Chats waiting for a reply: { [chatId]: { userMsg, startedAt } }. Several
  // chats can wait at once; within one chat Send waits for the reply so the
  // conversation stays in order.
  const [pending, setPending] = useState({});
  // "Ask an admin" state per assistant message, keyed `${chatId}:${index}`:
  // 'sending' | 'sent'.
  const [askStates, setAskStates] = useState({});
  // "Register a complaint" per assistant message, same keys:
  // { open: true } while the form shows, { result } once filed.
  const [complaints, setComplaints] = useState({});

  const stored = selectedChat?.messages || EMPTY;
  const pendingHere = chatId ? pending[chatId] : undefined;
  // The stored conversation plus this chat's optimistic question (until the
  // reply lands and appendMessages stores both).
  const messages = useMemo(
    () =>
      pendingHere && !stored.includes(pendingHere.userMsg) ? [...stored, pendingHere.userMsg] : stored,
    [stored, pendingHere]
  );
  const questions = useMemo(() => questionsByIndex(messages), [messages]);

  // Latest values for the stable callbacks below (they must not change
  // identity, or every memoised Message would re-render).
  const latest = useRef({});
  useLayoutEffect(() => {
    latest.current = { chatId, messages, questions, askStates, pending, token };
  });

  const waiting = !!pendingHere;
  useEffect(() => {
    containRef.current?.scrollTo({ top: containRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, chatId, waiting]);

  const openComplaint = useCallback((index) => {
    const id = latest.current.chatId;
    if (!id) return;
    const key = `${id}:${index}`;
    setComplaints((c) => (c[key] ? c : { ...c, [key]: { open: true } }));
  }, []);

  const closeComplaint = useCallback((index) => {
    const key = `${latest.current.chatId}:${index}`;
    setComplaints((c) => {
      if (!c[key]) return c;
      const next = { ...c };
      delete next[key];
      return next;
    });
  }, []);

  const complaintFiled = useCallback((index, result) => {
    const key = `${latest.current.chatId}:${index}`;
    setComplaints((c) => ({ ...c, [key]: { result } }));
    if (!result.duplicate) toast.success("Complaint registered");
  }, []);

  // Forward the user question that the assistant message at `index` replied to.
  const handleAskAdmin = useCallback(
    async (index) => {
      const { chatId: id, questions: qs, askStates: states } = latest.current;
      if (!id) return;
      const key = `${id}:${index}`;
      if (states[key]) return;

      const question = qs[index];
      if (!question) {
        toast.error("Couldn't find the question for this reply.");
        return;
      }

      setAskStates((s) => ({ ...s, [key]: "sending" }));
      const result = await dispatch(
        askAdmin({ question: question.slice(0, MAX_QUESTION_CHARS), chatId: id })
      ).unwrap();
      if (result.success) {
        setAskStates((s) => ({ ...s, [key]: "sent" }));
        toast.success("Sent to admin");
      } else {
        setAskStates((s) => {
          const next = { ...s };
          delete next[key];
          return next;
        });
        toast.error(result.message || "Failed to send your question");
      }
    },
    [dispatch]
  );

  // Called by the composer with already-validated text. Resolves to
  // { restore: true } when the text should go back into the input.
  const handleSend = useCallback(
    async (text, mode) => {
      const { chatId: id, pending: waiting, token: authToken } = latest.current;
      if (!id || waiting[id]) return { restore: true };

      const userMsg = { role: "user", content: text, timestamp: Date.now(), type: mode };
      // Commit the bubble before awaiting the request, so it never shows up
      // after a fast reply.
      flushSync(() => {
        setPending((p) => ({ ...p, [id]: { userMsg, startedAt: Date.now() } }));
      });

      try {
        const { data } = await axios.post(
          `/api/message/${mode}`,
          { chatId: id, prompt: text },
          { headers: { Authorization: authToken } }
        );
        if (!data.success) {
          toast.error(data.message || "Failed to send message");
          return { restore: latest.current.chatId === id };
        }
        // `answered` / `escalated` drive the "sent to the admin" note.
        // `suggestComplaint` highlights "Register a complaint" on the reply.
        const answered = data.answered ?? data.reply?.answered;
        const escalated = data.escalated ?? data.reply?.escalated;
        const suggestComplaint = data.suggestComplaint ?? data.reply?.suggestComplaint;
        const reply = {
          ...data.reply,
          timestamp: Date.now(),
          ...(typeof answered === "boolean" && { answered }),
          ...(typeof escalated === "boolean" && { escalated }),
          ...(typeof suggestComplaint === "boolean" && { suggestComplaint }),
          ...(data.questionId && { questionId: data.questionId }),
        };
        dispatch(appendMessages({ chatId: id, messages: [userMsg, reply], chatName: data.chatName }));
        if (latest.current.chatId !== id) {
          toast.success(`UniAssist replied in "${data.chatName || "another chat"}"`);
        }
        return {};
      } catch (error) {
        toast.error(error.response?.data?.message || error.message || "Failed to send message");
        return { restore: latest.current.chatId === id };
      } finally {
        setPending((p) => {
          if (!p[id]) return p;
          const next = { ...p };
          delete next[id];
          return next;
        });
      }
    },
    [dispatch]
  );

  const canComplain = user?.role !== "admin" && user?.role !== "staff";

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden ${
        isDark ? "bg-[#0E1422]" : "bg-linear-to-b from-[#E7E8F0] via-white to-[#F2F3F8]"
      }`}
    >
      <div className="flex-1 flex flex-col py-4 md:py-6 overflow-hidden">
        {/* Welcome Message when no chats */}
        {messages.length === 0 && !selectedChat && (
          <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
            <div
              className={`mb-4 p-4 md:p-6 rounded-xl border ${
                isDark
                  ? "bg-linear-to-r from-[#16203A] to-[#1E2A47] border-[#2A3656]"
                  : "bg-linear-to-r from-[#E7E8F0] to-[#F2F3F8] border-[#D8DAE6]"
              }`}
            >
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center relative bg-[#1E2A66] shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                  <span className="absolute bottom-1 left-2 right-2 h-0.5 rounded-full bg-[#E63027]" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-lg font-bold text-[#1F2330] dark:text-[#ECEEF5] mb-2">Welcome to UniAssist!</h2>
                  <p className={`text-sm ${isDark ? "text-[#9AA5BD]" : "text-[#5A6372]"}`}>
                    Your intelligent assistant for MAJU. Ask questions, draft emails, and get personalized help.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages Area */}
        <div ref={containRef} className="flex-1 mb-3 overflow-y-auto overscroll-contain scroll-smooth">
          <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center min-h-[60vh]">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#E7E8F0] dark:bg-[#1E2A47] flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-[#1E2A66] dark:text-[#E63027]" />
                  </div>
                  <p className="text-xl md:text-3xl text-center text-[#5A6372] dark:text-[#9AA5BD] mb-2">
                    Ask me Anything
                  </p>
                  <p className="text-sm text-[#5A6372] dark:text-[#9AA5BD]">
                    Start a conversation or choose a topic below
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => {
                const key = `${chatId}:${index}`;
                const actionable = message.role !== "user" && index !== 0;
                return (
                  <Message
                    key={key}
                    message={message}
                    index={index}
                    chatId={chatId}
                    question={actionable ? questions[index] : undefined}
                    onAskAdmin={actionable ? handleAskAdmin : undefined}
                    askState={askStates[key]}
                    onRegisterComplaint={actionable && canComplain ? openComplaint : undefined}
                    complaint={complaints[key]}
                    onComplaintCancel={closeComplaint}
                    onComplaintFiled={complaintFiled}
                  />
                );
              })
            )}

            {pendingHere && <ChatWaitIndicator startedAt={pendingHere.startedAt} isDark={isDark} />}
          </div>
        </div>

        <ChatComposer
          chatId={chatId}
          busy={!!pendingHere}
          showTopics={messages.length === 0}
          onSend={handleSend}
        />
      </div>
    </div>
  );
};

export default ChatPage;
