// pages/ChatPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";
import Message from "../components/Message";
import toast from "react-hot-toast";
import Sidebar from "../components/Sidebar";
import MobileMenuButton from "../components/MobileMenuButton";
import { Send, Mail, Calendar, Book, Users, Building, CreditCard, MessageSquare, Sparkles, Mic, Volume2, Disc } from "lucide-react";

const ChatPage = () => {
  const containRef = useRef(null);
  const { selectedChat, theme, user, axios, token, setUser } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("text");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);

  // Start recording audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 22050
        }
      });
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 64000
      });
      
      const chunks = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          
          // Check size during recording
          const tempBlob = new Blob(chunks, { type: 'audio/webm' });
          const sizeMB = tempBlob.size / (1024 * 1024);
          
          // Auto-stop if exceeds 4MB
          if (sizeMB > 4) {
            stopRecording();
            toast.error("Voice message too large (4MB limit). Recording stopped.");
          }
        }
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const sizeMB = audioBlob.size / (1024 * 1024);
        
        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Check file size
        if (sizeMB > 4) {
          toast.error(`Voice message is ${sizeMB.toFixed(2)}MB. Maximum size is 4MB.`);
          setRecordingTime(0);
          return;
        }
        
        // Send voice message
        await sendVoiceMessage(audioBlob, recordingTime);
        
        // Reset
        setRecordingTime(0);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioChunks(chunks);
      
      // Reset and start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Microphone access denied. Please allow microphone permissions.");
    }
  };

  // Stop recording and send
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Reset
    setRecordingTime(0);
    toast.info("Recording cancelled");
  };

  // Send voice message
  const sendVoiceMessage = async (audioBlob, duration) => {
    if (!user) {
      toast.error("Please login to send voice messages");
      return;
    }

    const sizeMB = audioBlob.size / (1024 * 1024);
    
    // Check size again
    if (sizeMB > 4) {
      toast.error(`Voice message is ${sizeMB.toFixed(2)}MB. Maximum size is 4MB.`);
      return;
    }

    setLoading(true);

    try {
      // Create URL for immediate display
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Add user voice message to chat
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: `[Voice Message]`,
          timestamp: Date.now(),
          isImage: false,
          mode: mode,
          isVoice: true,
          audioUrl: audioUrl,
          voiceDuration: duration,
          fileSize: sizeMB.toFixed(2)
        },
      ]);

      // Simulate API response
      setTimeout(() => {
        // Add AI response
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "I've received your voice message! How can I help you with this?",
          timestamp: Date.now(),
          isImage: false
        }]);
        
        setUser((prev) => ({ ...prev, credits: prev.credits - 1 }));
        toast.success("Voice message sent!");
        setLoading(false);
      }, 1000);

    } catch (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  // Format time (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Clean up
  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedChat) {
      setMessages(selectedChat.messages);
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
    { icon: <Book className="w-4 h-4" />, text: "What programs does MAJU offer?" },
    { icon: <Users className="w-4 h-4" />, text: "Admission requirements?" },
    { icon: <Calendar className="w-4 h-4" />, text: "Application deadlines?" },
    { icon: <CreditCard className="w-4 h-4" />, text: "Fee structure?" },
    { icon: <Building className="w-4 h-4" />, text: "Campus facilities?" },
    { icon: <Mail className="w-4 h-4" />, text: "Write an email to faculty" }
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Menu Button */}
      <MobileMenuButton 
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />
      
      {/* Sidebar - Now includes its own overlay */}
      <Sidebar 
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />

      {/* Main Chat Area - No overlay here */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden md:ml-0 ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-linear-to-b from-blue-50 via-white to-gray-50'
      }`}>
        
        {/* Mobile Header */}
        <header className={`md:hidden sticky top-0 z-10 border-b ${
          theme === 'dark' 
            ? 'bg-gray-900/95 border-gray-700 backdrop-blur-lg' 
            : 'bg-white/95 border-gray-200 backdrop-blur-lg'
        }`}>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setIsMenuOpen(true)}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'hover:bg-gray-800' 
                    : 'hover:bg-gray-100'
                }`}
              >
                <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <div className="flex flex-col items-center">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  UniAssist<span className="text-blue-600 dark:text-blue-400">.ai</span>
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">MAJU Assistant</p>
              </div>
              
              <div className="w-8"></div>
            </div>
          </div>
        </header>

        {/* Chat Container */}
        <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
          
          {/* Welcome Message when no chats */}
          {messages.length === 0 && !selectedChat && (
            <div className={`mb-4 p-4 md:p-6 rounded-xl ${
              theme === 'dark'
                ? 'bg-linear-to-r from-gray-800 to-gray-900 border border-gray-700'
                : 'bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100'
            }`}>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="p-3 bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Welcome to UniAssist!
                  </h2>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    Your intelligent assistant for MAJU University. Ask questions, draft emails, track deadlines, and get personalized help.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages Area */}
          <div
            ref={containRef}
            className="flex-1 mb-3 overflow-y-auto overscroll-contain scroll-smooth px-1"
            style={{
              WebkitOverflowScrolling: "touch",
            }}
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
              <>
                {messages.map((message, index) => (
                  <div key={index}>
                    <Message message={message} />
                    {message.isVoice && message.audioUrl && (
                      <div className="ml-4 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Volume2 className="w-4 h-4 text-blue-500" />
                          <span className="text-xs text-gray-500">
                            Voice message • {formatTime(message.voiceDuration || 0)}
                          </span>
                        </div>
                        <audio 
                          src={message.audioUrl} 
                          controls 
                          className="w-full max-w-md"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Loading Animation */}
            {loading && (
              <div className="flex justify-center py-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Processing...</p>
                </div>
              </div>
            )}
          </div>

          {/* Suggested Topics */}
          {messages.length === 0 && !isRecording && (
            <div className="mb-3">
              <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
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
                      theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                        : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm'
                    }`}
                  >
                    {topic.icon}
                    <span className="truncate text-xs">{topic.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Simple Voice Recording UI */}
          {isRecording ? (
            <div className={`p-3 rounded-xl border ${
              theme === 'dark'
                ? 'bg-linear-to-r from-blue-900/20 to-indigo-900/20 border-blue-700/30'
                : 'bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200'
            } shadow-sm`}>
              <div className="flex items-center justify-between">
                {/* Recording info */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-linear-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                    <Disc className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {formatTime(recordingTime)}
                    </div>
                    <div className="text-xs text-blue-500 dark:text-blue-400">
                      Recording voice...
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-4 py-1.5 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>

              {/* Simple size indicator */}
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                Maximum file size: 4MB • Click "Done" to send
              </div>
            </div>
          ) : (
            /* Normal Input Form */
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!prompt.trim()) return;
                
                try {
                  setLoading(true);
                  const promptCopy = prompt;
                  setPrompt("");
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "user",
                      content: prompt,
                      timestamp: Date.now(),
                      isImage: false,
                      mode: mode,
                    },
                  ]);
                  
                  const { data } = await axios.post(
                    `/api/message/${mode}`,
                    { 
                      chatId: selectedChat?._id, 
                      prompt
                    },
                    { headers: { Authorization: token } }
                  );

                  if (data.success) {
                    const reply = {
                      ...data.reply,
                      timestamp: Date.now(),
                    };
                    setMessages((prev) => [...prev, reply]);
                    setUser((prev) => ({ ...prev, credits: prev.credits - 1 }));
                  } else {
                    toast.error(data.message);
                    setPrompt(promptCopy);
                  }
                } catch (error) {
                  toast.error(error.response?.data?.message || error.message);
                } finally {
                  setLoading(false);
                }
              }}
              className={`p-2 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-300 shadow-sm'
              }`}
            >
              <div className="flex gap-1.5">
                {/* Mode Selector */}
                <select
                  onChange={(e) => setMode(e.target.value)}
                  value={mode}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                </select>
                
                {/* Input Field with Voice Button */}
                <div className="flex-1 relative">
                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    type="text"
                    placeholder={
                      mode === "email" 
                        ? "Write email content..." 
                        : "Type your query..."
                    }
                    required
                    className="w-full pl-3 pr-10 py-1.5 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm rounded-lg border border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                  />
                  
                  {/* Voice Button */}
                  <button
                    type="button"
                    onClick={startRecording}
                    className="absolute right-1.5 top-1/2 transform -translate-y-1/2 p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                    title="Record voice message"
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                {/* Send Button */}
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className={`px-3 py-1.5 rounded-lg transition-all shrink-0 flex items-center justify-center ${
                    loading || !prompt.trim()
                      ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                      : 'bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
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
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    mode === "email" ? "bg-blue-500" : "bg-emerald-500"
                  }`}></div>
                  <span className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {mode === "email" ? "Email Mode" : "Chat Mode"}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                  Credits: <span className="font-semibold text-blue-600 dark:text-blue-400">{user?.credits || 0}</span>
                </div>
              </div>
            </form>
          )}

          {/* Simple Instructions */}
          {!isRecording && (
            <div className="mt-2">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
                <span className="flex items-center justify-center gap-1">
                  <Mic className="w-2.5 h-2.5" />
                  Click microphone to record voice message (Max 4MB)
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;