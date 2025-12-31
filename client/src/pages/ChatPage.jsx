import React, { useEffect, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";
import Message from "../components/Message";
import toast from "react-hot-toast";
import {
  Send,
  Mail,
  Calendar,
  Book,
  Users,
  Building,
  CreditCard,
  MessageSquare,
  Sparkles,
  Mic,
} from "lucide-react";

const ChatPage = () => {
  const containRef = useRef(null);
  const {
    selectedChat,
    theme,
    user,
    axios,
    token,
    setUser,
    setChats, 
    setSelectedChat,
  } = useAppContext();
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
      // Check user credits for voice (3 credits required)
      if (user?.credits < 3) {
        toast.error("Insufficient credits. Voice messages require 3 credits.");
        return;
      }

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

        // Update user credits
        if (setUser && user) {
          const creditsUsed = response.data.creditsUsed || 3;
          setUser((prev) => ({
            ...prev,
            credits: Math.max(0, prev.credits - creditsUsed),
          }));
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

        // Refresh chats to get updated title
        if (setChats && setSelectedChat) {
          try {
            const { data } = await axios.get("/api/chat/all", {
              headers: { Authorization: token },
            });
            if (data.success) {
              setChats(data.chats);
              // Update selected chat
              const updatedChat = data.chats.find(
                (c) => c._id === selectedChat._id
              );
              if (updatedChat) {
                setSelectedChat(updatedChat);
              }
            }
          } catch (refreshError) {
            console.error("Failed to refresh chats:", refreshError);
          }
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
        } else if (response.data.message?.includes("Insufficient credits")) {
          toast.error(response.data.message);
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
      icon: <Book className="w-4 h-4" />,
      text: "What programs does MAJU offer?",
    },
    { icon: <Users className="w-4 h-4" />, text: "Admission requirements?" },
    { icon: <Calendar className="w-4 h-4" />, text: "Application deadlines?" },
    { icon: <CreditCard className="w-4 h-4" />, text: "Fee structure?" },
    { icon: <Building className="w-4 h-4" />, text: "Campus facilities?" },
    { icon: <Mail className="w-4 h-4" />, text: "Write an email to faculty" },
  ];

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || !selectedChat) return;

    try {
      setLoading(true);
      const promptCopy = prompt;
      setPrompt("");

      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: prompt,
          timestamp: Date.now(),
          type: mode,
        },
      ]);

      // Call API
      const { data } = await axios.post(
        `/api/message/${mode}`,
        {
          chatId: selectedChat._id,
          prompt,
        },
        { headers: { Authorization: token } }
      );

      if (data.success) {
        // Add AI response
        const reply = {
          ...data.reply,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, reply]);

        // Update user credits
        const creditDeduction = mode === "email" ? 2 : 1;
        setUser((prev) => ({
          ...prev,
          credits: Math.max(0, prev.credits - creditDeduction),
        }));
      } else {
        toast.error(data.message);
        setPrompt(promptCopy);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden ${
        theme === "dark"
          ? "bg-gray-900"
          : "bg-linear-to-b from-blue-50 via-white to-gray-50"
      }`}
    >
      {/* Chat Container */}
      <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
        {/* Welcome Message when no chats */}
        {messages.length === 0 && !selectedChat && (
          <div
            className={`mb-4 p-4 md:p-6 rounded-xl ${
              theme === "dark"
                ? "bg-linear-to-r from-gray-800 to-gray-900 border border-gray-700"
                : "bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100"
            }`}
          >
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="p-3 bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Welcome to UniAssist!
                </h2>
                <p
                  className={`text-sm ${
                    theme === "dark" ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Your intelligent assistant for MAJU University. Ask questions,
                  draft emails, and get personalized help.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages Area */}
        <div
          ref={containRef}
          className="flex-1 mb-3 overflow-y-auto overscroll-contain scroll-smooth px-1"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-linear-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xl md:text-3xl text-center text-gray-400 dark:text-gray-300 mb-2">
                  Ask me Anything
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
                  <div
                    className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Processing...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Topics */}
        {messages.length === 0 && !isRecording && (
          <div className="mb-3">
            <p
              className={`text-xs mb-2 ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
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
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all flex-1 min-w-[45%] md:flex-initial md:min-w-0 ${
                    theme === "dark"
                      ? "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                      : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm"
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
        {isRecording ? (
          <div
            className={`p-4 rounded-xl border ${
              theme === "dark"
                ? "bg-linear-to-r from-blue-900/20 to-indigo-900/20 border-blue-700/30"
                : "bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200"
            } shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Recording voice message...
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
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
            className={`p-2 rounded-xl border ${
              theme === "dark"
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-300 shadow-sm"
            }`}
          >
            <div className="flex gap-1.5">
              {/* Mode Selector */}
              {/* <select
                onChange={(e) => setMode(e.target.value)}
                value={mode}
                className={`px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  theme === "dark"
                    ? "bg-gray-800 border-gray-700 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="text">Text (1 credit)</option>
                <option value="email">Email (2 credits)</option>
              </select> */}

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
                  className="w-full pl-3 pr-10 py-1.5 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm rounded-lg border border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                  disabled={isRecording || isProcessingVoice}
                />

                {/* Voice Button */}
                {!isRecording && !isProcessingVoice && (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={!selectedChat || user?.credits < 3}
                    className="absolute right-1.5 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      user?.credits < 3
                        ? `Insufficient credits. Voice messages require 3 credits (You have ${user?.credits})`
                        : "Record voice message (3 credits)"
                    }
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
                    ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                    : "bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
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
            <div className="flex items-center justify-between mt-1.5 px-1">
              <div className="flex items-center gap-1">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    mode === "email" ? "bg-blue-500" : "bg-emerald-500"
                  }`}
                ></div>
                <span
                  className={`text-[10px] ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {mode === "email"
                    ? "Email Mode (2 credits)"
                    : "Chat Mode (1 credit)"}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                Credits:{" "}
                <span
                  className={`font-semibold ${
                    user?.credits < 3
                      ? "text-red-600 dark:text-red-400"
                      : "text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {user?.credits || 0}
                </span>
                {user?.credits < 3 && (
                  <span className="ml-1 text-red-500">(Low)</span>
                )}
              </div>
            </div>
          </form>
        )}

        {/* Simple Instructions */}
        {/* {!isRecording && !isProcessingVoice && (
          <div className="mt-2">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
              <span className="flex items-center justify-center gap-1">
                <Mic className="w-2.5 h-2.5" />
                Voice messages: 3 credits • Max 30s • 2MB
              </span>
            </p>
          </div>
        )} */}
      </div>
    </div>
  );
};

export default ChatPage;
