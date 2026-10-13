import React, { memo, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import axios from "../../utils/axios";
import toast from "react-hot-toast";
import { Send, Mic, Book, Users, Building, Wallet, Sparkles } from "lucide-react";
import { ProgressLine } from "../../components/ProgressSteps";

const MAX_PROMPT_CHARS = 4000;
const TRANSCRIBE_TIMEOUT_MS = 90000;

const SUGGESTED_TOPICS = [
  { Icon: Wallet, text: "What is the fee structure for the Bachelor programs?" },
  { Icon: Users, text: "What documents are required at the time of admission?" },
  { Icon: Building, text: "Is MAJU recognized by H.E.C?" },
  { Icon: Book, text: "In which areas MAJU offer degrees?" },
  { Icon: Sparkles, text: "Does MAJU offer any scholarships?" },
];

// Convert blob to base64
const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// Format time (MM:SS)
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// Aborted by our timeout (AbortController -> axios CanceledError) or by
// axios' own timeout.
const isTimeout = (error) =>
  axios.isCancel(error) ||
  error?.code === "ERR_CANCELED" ||
  error?.code === "ECONNABORTED" ||
  error?.name === "AbortError" ||
  error?.name === "CanceledError";

/**
 * The student chat input: text box, mode, voice recording/transcription and
 * the quick-start topics. All keystroke/recording state lives here, so typing
 * re-renders only this component — never the message list above it.
 *
 * onSend(text, mode) -> Promise<{ restore?: boolean }>: `restore` puts the
 * text back (the send failed and the user is still on that chat).
 * `busy`: this chat is waiting for a reply (Send disabled, reason shown).
 */
const ChatComposer = ({ chatId, busy, showTopics, onSend }) => {
  const theme = useSelector((s) => s.theme.theme);
  const token = useSelector((s) => s.auth.token);
  const isDark = theme === "dark";

  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("text");

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  // Timestamp while /api/message/transcribe runs (drives "Transcribing… 12 s").
  const [transcribingSince, setTranscribingSince] = useState(null);
  const isProcessingVoice = transcribingSince !== null;

  const timerRef = useRef(null);
  const recordingTimeRef = useRef(0);
  const audioChunksRef = useRef([]);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  // Set by Cancel (and unmount) so onstop discards the audio instead of
  // transcribing it.
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);
  const chatIdRef = useRef(chatId);
  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  // Release the microphone if the user navigates away mid-recording.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // already stopped
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetRecordingTime = () => {
    setRecordingTime(0);
    recordingTimeRef.current = 0;
  };

  // Transcribe ONLY and drop the text into the input field. The user
  // reviews/edits it and presses Send themselves.
  const processVoiceMessage = async (audioBlob, duration) => {
    if (!chatIdRef.current) {
      toast.error("Please select a chat to record voice messages");
      return;
    }
    const sizeMB = audioBlob.size / (1024 * 1024);
    if (sizeMB > 2) {
      toast.error(`Voice message is ${sizeMB.toFixed(2)}MB. Maximum size is 2MB.`);
      return;
    }
    if (sizeMB < 0.001 || duration < 1) {
      toast.error("Recording is too short. Please speak for at least 1 second.");
      return;
    }
    if (duration < 2 && sizeMB < 0.01) {
      toast.error("No speech detected. Please speak clearly.");
      return;
    }

    setTranscribingSince(Date.now());
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const { data } = await axios.post(
        "/api/message/transcribe",
        { audioUrl: base64Audio, duration, fileSize: sizeMB.toFixed(2) },
        {
          headers: { Authorization: token, "Content-Type": "application/json" },
          signal: controller.signal,
        }
      );
      if (!mountedRef.current) return;

      if (data.success && data.transcription) {
        // Added to whatever is already typed, so nothing the user wrote is lost.
        const text = String(data.transcription).trim();
        setPrompt((cur) => (cur.trim() ? `${cur.trimEnd()} ${text}` : text).slice(0, MAX_PROMPT_CHARS));
        toast.success("Voice transcribed. Review and send when ready.");
        if (data.transcriptionDetails?.isFallback) {
          toast("Voice transcribed with basic fallback. Text may be less accurate.", {
            icon: "⚠️",
            duration: 4000,
          });
        }
      } else if (data.message?.includes("No speech detected") || data.message?.includes("too short")) {
        toast.error("No speech detected. Please speak clearly and try again.");
      } else {
        toast.error(data.message || "Failed to transcribe voice message");
      }
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Error transcribing voice:", error);
      if (isTimeout(error)) {
        toast.error("Transcription took too long. Please try again.");
      } else if (error.response?.status === 413) {
        toast.error("Voice message too large. Please record a shorter message (max 2MB).");
      } else if (error.response?.status === 400) {
        const errorMsg = error.response.data?.message || "Invalid audio format.";
        toast.error(
          errorMsg.includes("too small") || errorMsg.includes("speak longer")
            ? "Recording too short. Please speak for at least 2-3 seconds."
            : errorMsg
        );
      } else if (error.response?.status >= 500) {
        toast.error(error.response.data?.message || "Server error transcribing voice. Please try again.");
      } else if (error.code === "ERR_NETWORK") {
        toast.error("Network error. Please check your connection.");
      } else {
        toast.error("Failed to transcribe voice message. Please try again.");
      }
    } finally {
      clearTimeout(timeoutId);
      if (mountedRef.current) setTranscribingSince(null);
    }
  };

  const startRecording = async () => {
    if (!chatId) {
      toast.error("Please select or create a chat first");
      return;
    }
    // getUserMedia only exists on secure origins (https or localhost).
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice needs HTTPS or localhost");
      return;
    }
    if (typeof window.MediaRecorder === "undefined") {
      toast.error("Voice recording isn't supported in this browser.");
      return;
    }

    try {
      clearTimer();
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            channelCount: 1,
          },
        })
        .catch((error) => {
          console.error("Microphone access error:", error);
          if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            toast.error("Microphone access denied. Please check browser permissions.");
          } else if (error.name === "NotFoundError") {
            toast.error("No microphone found on your device.");
          } else {
            toast.error(`Microphone error: ${error.message}`);
          }
          throw error;
        });

      let mimeType = "";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) mimeType = "audio/webm;codecs=opus";
      else if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";

      streamRef.current = stream;
      let recorder;
      try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      } catch (error) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        toast.error("Voice recording isn't supported in this browser.");
        throw error;
      }
      recorderRef.current = recorder;
      cancelledRef.current = false;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        if (mountedRef.current) setIsRecording(false);
        clearTimer();
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        if (recorderRef.current === recorder) recorderRef.current = null;

        const duration = recordingTimeRef.current;
        if (mountedRef.current) resetRecordingTime();
        if (cancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        audioChunksRef.current = [];
        await processVoiceMessage(audioBlob, duration);
      };

      recorder.onerror = (event) => {
        console.error("Recorder error:", event);
        toast.error("Recording error. Please try again.");
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        clearTimer();
        audioChunksRef.current = [];
        setIsRecording(false);
        resetRecordingTime();
      };

      recorder.start(100);
      setIsRecording(true);
      resetRecordingTime();

      timerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);
        // Stop recording at 30 seconds
        if (recordingTimeRef.current >= 30) {
          clearTimer();
          if (recorder.state === "recording") {
            recorder.stop();
            toast("Recording stopped automatically after 30 seconds.", { icon: "ℹ️" });
          }
        }
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
      resetRecordingTime();
      clearTimer();
    }
  };

  // Stop recording and transcribe
  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      try {
        recorder.stop();
      } catch (error) {
        console.error("Error stopping recording:", error);
      }
    }
    clearTimer();
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    stopRecording();
    setIsRecording(false);
    resetRecordingTime();
    toast("Recording cancelled", { icon: "ℹ️" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || !chatId || busy || isRecording || isProcessingVoice) return;
    if (trimmed.length > MAX_PROMPT_CHARS) {
      toast.error(`Message is too long (max ${MAX_PROMPT_CHARS} characters).`);
      return;
    }
    setPrompt("");
    const result = await onSend(trimmed, mode);
    // Give the question back so the user can retry without retyping it.
    if (result?.restore && mountedRef.current) setPrompt((cur) => cur || trimmed);
  };

  const sendBlocked = busy || !prompt.trim() || !chatId || isRecording || isProcessingVoice;
  const sendTitle = busy
    ? "Wait for UniAssist to finish replying in this chat"
    : !chatId
    ? "Select or create a chat first"
    : "Send message";

  return (
    <>
      {/* Suggested Topics */}
      {showTopics && !isRecording && (
        <div className="w-full max-w-4xl mx-auto px-4 md:px-6 mb-3">
          <p className={`text-xs mb-2 ${isDark ? "text-[#9AA5BD]" : "text-[#5A6372]"}`}>Quick Start Topics:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_TOPICS.map((topic) => {
              const TopicIcon = topic.Icon;
              const { text } = topic;
              return (
              <button
                key={text}
                type="button"
                onClick={() => {
                  setPrompt(text);
                  if (text.includes("email")) setMode("email");
                }}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all flex-1 min-w-[45%] md:flex-initial md:min-w-0 ${
                  isDark
                    ? "bg-[#16203A] hover:bg-[#1E2A47] text-[#ECEEF5] border border-[#2A3656]"
                    : "bg-white hover:bg-[#F2F3F8] text-[#1F2330] border border-[#D8DAE6] shadow-sm"
                }`}
              >
                <TopicIcon className="w-4 h-4" />
                <span className="truncate text-xs">{text}</span>
              </button>
            );
            })}
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
        {isRecording ? (
          <div
            className={`p-4 rounded-xl border ${
              isDark ? "bg-[#16203A] border-[#2A3656]" : "bg-[#FCE6E4] border-[#D8DAE6]"
            } shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E63027] flex items-center justify-center animate-pulse">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold text-[#E63027] tabular-nums">{formatTime(recordingTime)}</div>
                  <div className="text-xs text-[#5A6372] dark:text-[#9AA5BD]">Recording voice message...</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-4 py-2 text-sm text-[#5A6372] dark:text-[#9AA5BD] hover:text-[#E63027] rounded-lg hover:bg-white/60 dark:hover:bg-[#1E2A47] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-5 py-2 bg-[#E63027] hover:bg-[#C81E15] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Stop &amp; Transcribe
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className={`p-1 rounded-xl border ${
              isDark ? "bg-[#16203A] border-[#2A3656]" : "bg-white border-[#D8DAE6] shadow-sm"
            }`}
          >
            <div className="flex gap-1.5">
              <div className="flex-1 relative">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={MAX_PROMPT_CHARS}
                  type="text"
                  aria-label="Message"
                  placeholder={mode === "email" ? "Write email content..." : "Type your query or record voice..."}
                  className="w-full pl-3 pr-10 py-1.5 bg-transparent outline-none text-[#1F2330] dark:text-[#ECEEF5] placeholder-[#5A6372] dark:placeholder-[#9AA5BD] text-sm rounded-lg border border-[#D8DAE6] dark:border-[#2A3656] focus:border-[#1E2A66] dark:focus:border-[#E63027] focus:ring-1 focus:ring-[#1E2A66]/20 dark:focus:ring-[#E63027]/20"
                  disabled={isProcessingVoice}
                />
                {!isProcessingVoice && (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={!chatId}
                    className="absolute right-1.5 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md text-[#1E2A66] dark:text-[#E63027] hover:text-[#E63027] dark:hover:text-[#C48A4A] hover:bg-[#E7E8F0] dark:hover:bg-[#1E2A47] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Record voice message"
                    aria-label="Record voice message"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={sendBlocked}
                aria-label={sendTitle}
                title={sendTitle}
                className={`px-3 py-1.5 rounded-lg transition-all shrink-0 flex items-center justify-center ${
                  sendBlocked
                    ? "bg-[#D8DAE6] dark:bg-[#2A3656] cursor-not-allowed"
                    : "bg-[#1E2A66] hover:bg-[#16204D]"
                }`}
              >
                {busy ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-1 mt-1.5 px-1 min-h-4">
              {isProcessingVoice ? (
                <ProgressLine label="Transcribing your voice…" startedAt={transcribingSince} className="text-[11px]" />
              ) : (
                <>
                  <div className={`w-1.5 h-1.5 rounded-full ${mode === "email" ? "bg-[#1E2A66]" : "bg-[#3BAA75]"}`}></div>
                  <span className={`text-[10px] ${isDark ? "text-[#9AA5BD]" : "text-[#5A6372]"}`}>
                    {mode === "email" ? "Email Mode" : "Chat Mode"}
                    {busy && " · UniAssist is replying — you can send your next message when it's done"}
                  </span>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </>
  );
};

export default memo(ChatComposer);
