import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "../../utils/axios";
import { setChats, setSelectedChat } from "../../redux/slices/chatSlice";
import Message from "../components/Message";
import toast from "react-hot-toast";
import {
  Send,
  Mail,
  Calendar,
  Book,
  Users,
  Building,
  Wallet,
  MessageSquare,
  Sparkles,
  Mic,
} from "lucide-react";

const ChatPage = () => {
  const containRef = useRef(null);
  const dispatch = useDispatch();
  const selectedChat = useSelector((s) => s.chat.selectedChat);
  const theme = useSelector((s) => s.theme.theme);
  const user = useSelector((s) => s.auth.user);
  const token = useSelector((s) => s.auth.token);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("text");

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  // Refs for audio management
  const recordingTimeRef = useRef(0);
  const audioChunksRef = useRef([]);

  // Clean up audio resources on unmount
  useEffect(() => {
    return () => {
      cleanupAudioResources();
    };
  }, []);

  // Clean up audio resources
  const cleanupAudioResources = () => {
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Reset audio chunks
    audioChunksRef.current = [];
  };

  // Convert blob to base64
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      if (!selectedChat) {
        toast.error("Please select or create a chat first");
        return;
      }

      // Clean up any existing audio resources first
      cleanupAudioResources();

      // Request microphone access
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

          if (
            error.name === "NotAllowedError" ||
            error.name === "PermissionDeniedError"
          ) {
            toast.error(
              "Microphone access denied. Please check browser permissions."
            );
          } else if (error.name === "NotFoundError") {
            toast.error("No microphone found on your device.");
          } else {
            toast.error(`Microphone error: ${error.message}`);
          }
          throw error;
        });

      // Get supported MIME type
      let mimeType = "";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      }

      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);

      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        const sizeMB = audioBlob.size / (1024 * 1024);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());

        // Check file size
        if (sizeMB > 2) {
          toast.error(
            `Voice message is ${sizeMB.toFixed(
              2
            )}MB. Maximum size is 2MB. Record a shorter message.`
          );
          setRecordingTime(0);
          recordingTimeRef.current = 0;
          return;
        }

        // Process the voice message
        await processVoiceMessage(audioBlob, recordingTimeRef.current);

        // Reset
        setRecordingTime(0);
        recordingTimeRef.current = 0;
      };

      // Handle recorder errors
      recorder.onerror = (event) => {
        console.error("Recorder error:", event);
        toast.error("Recording error. Please try again.");

        // Clean up on error
        stream.getTracks().forEach((track) => track.stop());
        cleanupAudioResources();
        setIsRecording(false);
        setRecordingTime(0);
        recordingTimeRef.current = 0;
      };

      // Start recording
      recorder.start(100);
      setMediaRecorder(recorder);
      setIsRecording(true);

      // Reset recording time
      setRecordingTime(0);
      recordingTimeRef.current = 0;

      // Start timer
      timerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);

        // Stop recording at 30 seconds
        if (recordingTimeRef.current >= 30) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          if (recorder && recorder.state === "recording") {
            recorder.stop();
            toast.info("Recording stopped automatically after 30 seconds.");
          }
        }
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      cleanupAudioResources();
    }
  };

  // Stop recording and send
  const stopRecording = () => {
    if (mediaRecorder && isRecording && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop();
        setIsRecording(false);
      } catch (error) {
        console.error("Error stopping recording:", error);
      }
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    if (mediaRecorder && isRecording && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop();
        setIsRecording(false);
      } catch (error) {
        console.error("Error canceling recording:", error);
      }
    }

    // Clean up all resources
    cleanupAudioResources();

    // Reset
    setRecordingTime(0);
    recordingTimeRef.current = 0;
    toast.info("Recording cancelled");
  };

  // Process voice message
  // Process voice message - FIXED VERSION
  const processVoiceMessage = async (audioBlob, duration) => {
    if (!user || !selectedChat) {
      toast.error("Please login and select a chat to send voice messages");
      return;
    }

    const sizeMB = audioBlob.size / (1024 * 1024);

    // Enhanced validation
    if (sizeMB > 2) {
      toast.error(
        `Voice message is ${sizeMB.toFixed(2)}MB. Maximum size is 2MB.`
      );
      return;
    }

    if (sizeMB < 0.001 || duration < 1) {
      toast.error(
        "Recording is too short. Please speak for at least 2 seconds."
      );
      return;
    }

    if (duration < 2 && sizeMB < 0.01) {
      toast.error("No speech detected. Please speak clearly.");
      return;
    }

    setIsProcessingVoice(true);
    setLoading(true);

    let tempMessageId = Date.now();

    try {
      // Step 1: Show temporary message ONLY IN FRONTEND (not sent to backend)
      const tempVoiceMessage = {
        id: tempMessageId,
        role: "user",
        content: "[Processing voice message...]",
        timestamp: Date.now(),
        type: "voice",
        voiceMeta: {
          duration: duration,
          fileSize: sizeMB.toFixed(2),
        },
        isProcessing: true,
      };

      // Add temporary message to local state only
      setMessages((prev) => [...prev, tempVoiceMessage]);

      // Scroll to bottom
      setTimeout(() => {
        if (containRef.current) {
          containRef.current.scrollTo({
            top: containRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 100);

      // Step 2: Convert blob to base64 for API
      const base64Audio = await blobToBase64(audioBlob);

      // Step 3: Call your backend API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const response = await axios.post(
        "/api/message/voice",
        {
          chatId: selectedChat._id,
          audioUrl: base64Audio,
          duration: duration,
          fileSize: sizeMB.toFixed(2),
        },
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.data.success) {
        // Step 4: Replace temporary message with actual transcription from backend
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessageId
              ? {
                  ...msg,
                  content:
                    response.data.transcription || "Voice message transcribed",
                  isProcessing: false,
                  voiceMeta: {
                    ...msg.voiceMeta,
                    wasTranscribed: true,
                    transcriptionService:
                      response.data.transcriptionDetails?.service || "unknown",
                    isFallback:
                      response.data.transcriptionDetails?.isFallback || false,
                  },
                }
              : msg
          )
        );

        // Step 5: Add AI response from backend
        if (response.data.reply) {
          const aiMessage = {
            role: "assistant",
            content: response.data.reply.content,
            timestamp: Date.now(),
            type: "text",
            isVoiceResponse: true,
          };
          setMessages((prev) => [...prev, aiMessage]);
        }

        // Show success message
        toast.success("Voice message processed successfully!");

        // Show warning for fallback transcription
        if (response.data.transcriptionDetails?.isFallback) {
          toast(
            "Voice transcribed with basic fallback. Text may be less accurate.",
            {
              icon: "⚠️",
              duration: 4000,
            }
          );
        }

        try {
          const { data } = await axios.get("/api/chat/all", {
            headers: { Authorization: token },
          });
          if (data.success) {
            dispatch(setChats(data.chats));
            const updatedChat = data.chats.find(
              (c) => c._id === selectedChat._id
            );
            if (updatedChat) {
              dispatch(setSelectedChat(updatedChat));
            }
          }
        } catch (refreshError) {
          console.error("Failed to refresh chats:", refreshError);
        }
      } else {
        // Remove temporary message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));

        if (
          response.data.message?.includes("No speech detected") ||
          response.data.message?.includes("too short")
        ) {
          toast.error(
            "No speech detected. Please speak clearly and try again."
          );
        } else {
          toast.error(
            response.data.message || "Failed to process voice message"
          );
        }
      }
    } catch (error) {
      console.error("Error processing voice:", error);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));

      if (error.name === "AbortError") {
        toast.error("Request timeout. Please try again.");
      } else if (error.response?.status === 413) {
        toast.error(
          "Voice message too large. Please record a shorter message (max 2MB)."
        );
      } else if (error.response?.status === 400) {
        const errorMsg = error.response.data.message || "Invalid audio format.";
        if (
          errorMsg.includes("too small") ||
          errorMsg.includes("speak longer")
        ) {
          toast.error(
            "Recording too short. Please speak for at least 2-3 seconds."
          );
        } else {
          toast.error(errorMsg);
        }
      } else if (error.response?.status === 500) {
        toast.error("Server error processing voice. Please try again.");
      } else {
        toast.error("Failed to process voice message. Please try again.");
      }
    } finally {
      setIsProcessingVoice(false);
      setLoading(false);
    }
  };

  // Format time (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  useEffect(() => {
    if (selectedChat) {
      setMessages(selectedChat.messages || []);
    } else {
      setMessages([]);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (containRef.current) {
      containRef.current.scrollTo({
        top: containRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const suggestedTopics = [
    {
      icon: <Wallet className="w-4 h-4" />,
      text: "What is the fee structure for the Bachelor programs?",
    },
    {
      icon: <Users className="w-4 h-4" />,
      text: "What documents are required at the time of admission?",
    },
    {
      icon: <Building className="w-4 h-4" />,
      text: "Is MAJU recognized by H.E.C?",
    },
    {
      icon: <Book className="w-4 h-4" />,
      text: "In which areas MAJU offer degrees?",
    },
    {
      icon: <Sparkles className="w-4 h-4" />,
      text: "Does MAJU offer any scholarships?",
    },
  ];

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || !selectedChat || loading) return;

    // Build the optimistic user message FIRST so the render that flushes
    // after this handler yields (await axios.post) already includes it.
    // Previously `content: prompt` was read after `setPrompt("")` which,
    // while technically a closure read, was fragile and hard to read.
    const userMsg = {
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
      type: mode,
    };

    // flushSync forces React to commit BEFORE we hit `await axios.post`.
    // Without it, React 18's auto-batching can defer the render until after
    // the network response resolves on fast LLM replies — which is exactly
    // why the user bubble seemed to appear "after" the assistant reply.
    flushSync(() => {
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
    });
    setPrompt("");

    // Now that the DOM has the new bubble, scroll it into view.
    if (containRef.current) {
      containRef.current.scrollTo({
        top: containRef.current.scrollHeight,
        behavior: "smooth",
      });
    }

    try {
      const { data } = await axios.post(
        `/api/message/${mode}`,
        {
          chatId: selectedChat._id,
          prompt: trimmed,
        },
        { headers: { Authorization: token } }
      );

      if (data.success) {
        const reply = {
          ...data.reply,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, reply]);
      } else {
        toast.error(data.message);
        // Roll back: remove the optimistic message and restore the input.
        setMessages((prev) =>
          prev.filter((m) => m !== userMsg && m.timestamp !== userMsg.timestamp)
        );
        setPrompt(trimmed);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      setMessages((prev) =>
        prev.filter((m) => m !== userMsg && m.timestamp !== userMsg.timestamp)
      );
      setPrompt(trimmed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden ${
        theme === "dark"
          ? "bg-[#0E1422]"
          : "bg-linear-to-b from-[#E7E8F0] via-white to-[#F2F3F8]"
      }`}
    >
      {/* Chat Container */}
      <div className="flex-1 flex flex-col py-4 md:py-6 overflow-hidden">
        {/* Welcome Message when no chats */}
        {messages.length === 0 && !selectedChat && (
          <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
          <div
            className={`mb-4 p-4 md:p-6 rounded-xl border ${
              theme === "dark"
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
                <h2 className="text-lg font-bold text-[#1F2330] dark:text-[#ECEEF5] mb-2">
                  Welcome to UniAssist!
                </h2>
                <p
                  className={`text-sm ${
                    theme === "dark" ? "text-[#9AA5BD]" : "text-[#5A6372]"
                  }`}
                >
                  Your intelligent assistant for MAJU. Ask questions,
                  draft emails, and get personalized help.
                </p>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Chat Messages Area */}
        <div
          ref={containRef}
          className="flex-1 mb-3 overflow-y-auto overscroll-contain scroll-smooth"
        >
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
            messages.map((message, index) => (
              <Message key={index} message={message} />
            ))
          )}

          {/* Loading Animation */}
          {loading && !isProcessingVoice && (
            <div className="flex justify-center py-4">
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#E63027] animate-bounce"></div>
                  <div
                    className="w-2 h-2 rounded-full bg-[#E63027] animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-[#E63027] animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
                <p className="text-xs text-[#5A6372] dark:text-[#9AA5BD]">
                  Processing...
                </p>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Suggested Topics */}
        {messages.length === 0 && !isRecording && (
          <div className="w-full max-w-4xl mx-auto px-4 md:px-6 mb-3">
            <p
              className={`text-xs mb-2 ${
                theme === "dark" ? "text-[#9AA5BD]" : "text-[#5A6372]"
              }`}
            >
              Quick Start Topics:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedTopics.map((topic, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setPrompt(topic.text);
                    if (topic.text.includes("email")) setMode("email");
                  }}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all flex-1 min-w-[45%] md:flex-initial md:min-w-0 ${
                    theme === "dark"
                      ? "bg-[#16203A] hover:bg-[#1E2A47] text-[#ECEEF5] border border-[#2A3656]"
                      : "bg-white hover:bg-[#F2F3F8] text-[#1F2330] border border-[#D8DAE6] shadow-sm"
                  }`}
                >
                  {topic.icon}
                  <span className="truncate text-xs">{topic.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Voice Recording UI */}
        <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
        {isRecording ? (
          <div
            className={`p-4 rounded-xl border ${
              theme === "dark"
                ? "bg-[#16203A] border-[#2A3656]"
                : "bg-[#FCE6E4] border-[#D8DAE6]"
            } shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E63027] flex items-center justify-center animate-pulse">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold text-[#E63027] dark:text-[#E63027]">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="text-xs text-[#5A6372] dark:text-[#9AA5BD]">
                    Recording voice message...
                  </div>
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
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Normal Input Form */
          <form
            onSubmit={handleTextSubmit}
            className={`p-1 rounded-xl border ${
              theme === "dark"
                ? "bg-[#16203A] border-[#2A3656]"
                : "bg-white border-[#D8DAE6] shadow-sm"
            }`}
          >
            <div className="flex gap-1.5">
              {/* Input Field with Voice Button */}
              <div className="flex-1 relative">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  type="text"
                  placeholder={
                    mode === "email"
                      ? "Write email content..."
                      : "Type your query or record voice..."
                  }
                  required
                  className="w-full pl-3 pr-10 py-1.5 bg-transparent outline-none text-[#1F2330] dark:text-[#ECEEF5] placeholder-[#5A6372] dark:placeholder-[#9AA5BD] text-sm rounded-lg border border-[#D8DAE6] dark:border-[#2A3656] focus:border-[#1E2A66] dark:focus:border-[#E63027] focus:ring-1 focus:ring-[#1E2A66]/20 dark:focus:ring-[#E63027]/20"
                  disabled={isRecording || isProcessingVoice}
                />

                {/* Voice Button */}
                {!isRecording && !isProcessingVoice && (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={!selectedChat}
                    className="absolute right-1.5 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md text-[#1E2A66] dark:text-[#E63027] hover:text-[#E63027] dark:hover:text-[#C48A4A] hover:bg-[#E7E8F0] dark:hover:bg-[#1E2A47] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Record voice message"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={
                  loading ||
                  !prompt.trim() ||
                  !selectedChat ||
                  isRecording ||
                  isProcessingVoice
                }
                className={`px-3 py-1.5 rounded-lg transition-all shrink-0 flex items-center justify-center ${
                  loading ||
                  !prompt.trim() ||
                  !selectedChat ||
                  isRecording ||
                  isProcessingVoice
                    ? "bg-[#D8DAE6] dark:bg-[#2A3656] cursor-not-allowed"
                    : "bg-linear-to-r from-[#1E2A66] to-[#1E2A66] hover:from-[#16204D] hover:to-[#16204D]"
                }`}
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>

            {/* Mode Indicator */}
            <div className="flex items-center gap-1 mt-1.5 px-1">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  mode === "email" ? "bg-[#1E2A66]" : "bg-[#3BAA75]"
                }`}
              ></div>
              <span
                className={`text-[10px] ${
                  theme === "dark" ? "text-[#9AA5BD]" : "text-[#5A6372]"
                }`}
              >
                {mode === "email" ? "Email Mode" : "Chat Mode"}
              </span>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
