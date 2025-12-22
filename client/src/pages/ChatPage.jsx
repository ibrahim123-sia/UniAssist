import React, { useEffect, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";
import Message from "../components/Message";
import toast from "react-hot-toast";
import { Send, Mail, Calendar, Book, Users, Building, CreditCard, MessageSquare, Sparkles, Mic, Volume2, Disc, Loader2 } from "lucide-react";

const ChatPage = () => {
  const containRef = useRef(null);
  const { selectedChat, theme, user, axios, token, setUser, sendVoiceMessage } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("text");
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

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

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });
      
      const options = { mimeType: 'audio/webm;codecs=opus' };
      const recorder = new MediaRecorder(stream, options);
      
      const chunks = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
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
        
        // Process the voice message
        await processVoiceMessage(audioBlob, recordingTime);
        
        // Reset
        setRecordingTime(0);
      };
      
      recorder.start(100); // Collect data every 100ms
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

  // Process voice message (upload and send)
  const processVoiceMessage = async (audioBlob, duration) => {
    if (!user || !selectedChat) {
      toast.error("Please login and select a chat to send voice messages");
      return;
    }

    const sizeMB = audioBlob.size / (1024 * 1024);
    
    // Check size again
    if (sizeMB > 4) {
      toast.error(`Voice message is ${sizeMB.toFixed(2)}MB. Maximum size is 4MB.`);
      return;
    }

    setIsProcessingVoice(true);
    setLoading(true);

    try {
      // Step 1: Create URL for immediate playback
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Step 2: Show temporary message with loading state
      const tempMessageId = Date.now();
      const tempVoiceMessage = {
        id: tempMessageId,
        role: "user",
        content: "[Processing voice message...]",
        timestamp: Date.now(),
        isVoice: true,
        audioUrl: audioUrl,
        voiceDuration: duration,
        fileSize: sizeMB.toFixed(2),
        isProcessing: true,
        transcription: "" // Will be filled after API response
      };
      
      setMessages(prev => [...prev, tempVoiceMessage]);
      
      // Scroll to bottom
      setTimeout(() => {
        if (containRef.current) {
          containRef.current.scrollTo({
            top: containRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 100);

      // Step 3: Convert blob to base64 for API
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result;
          
          // Step 4: Call your backend API
          const response = await sendVoiceMessage(
  selectedChat._id,
  audioBlob, // Send the blob directly
  duration,
  sizeMB.toFixed(2)
);

          if (response.data.success) {
            // Step 5: Update the temporary message with transcribed text
            setMessages(prev => prev.map(msg => 
              msg.id === tempMessageId 
                ? {
                    ...msg,
                    content: response.data.transcription || "Voice message transcribed",
                    isProcessing: false,
                    transcription: response.data.transcription,
                    type: "voice"
                  }
                : msg
            ));

            // Step 6: Add AI response
            setTimeout(() => {
              if (response.data.reply) {
                const aiMessage = {
                  role: "assistant",
                  content: response.data.reply.content,
                  timestamp: Date.now(),
                  type: "text"
                };
                setMessages(prev => [...prev, aiMessage]);
              }
              
              // Update user credits
              if (setUser && user) {
                setUser(prev => ({ 
                  ...prev, 
                  credits: Math.max(0, prev.credits - 3) 
                }));
              }
              
              toast.success("Voice message sent!");
            }, 500);

          } else {
            // Remove temporary message on error
            setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
            toast.error(response.data.message || "Failed to process voice message");
          }
          
        } catch (error) {
          console.error("Error processing voice:", error);
          // Remove temporary message on error
          setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
          toast.error("Failed to process voice message. Please try again.");
        } finally {
          setIsProcessingVoice(false);
          setLoading(false);
        }
      };

      reader.onerror = () => {
        toast.error("Failed to read audio file");
        setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
        setIsProcessingVoice(false);
        setLoading(false);
      };

    } catch (error) {
      console.error("Voice processing error:", error);
      toast.error("Error processing voice message");
      setIsProcessingVoice(false);
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
    { icon: <Book className="w-4 h-4" />, text: "What programs does MAJU offer?" },
    { icon: <Users className="w-4 h-4" />, text: "Admission requirements?" },
    { icon: <Calendar className="w-4 h-4" />, text: "Application deadlines?" },
    { icon: <CreditCard className="w-4 h-4" />, text: "Fee structure?" },
    { icon: <Building className="w-4 h-4" />, text: "Campus facilities?" },
    { icon: <Mail className="w-4 h-4" />, text: "Write an email to faculty" }
  ];

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-linear-to-b from-blue-50 via-white to-gray-50'
    }`}>
      
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
                  
                  {/* Voice Message with Audio Player and Transcription */}
                  {message.isVoice && (
                    <div className={`ml-4 mb-4 ${message.role === 'user' ? 'mr-4 text-right' : 'ml-4'}`}>
                      {message.isProcessing ? (
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          <span className="text-xs text-gray-500">
                            Transcribing voice message...
                          </span>
                        </div>
                      ) : (
                        <>
                          {/* Transcription Text */}
                          {message.transcription && (
                            <div className={`mb-2 p-3 rounded-lg ${
                              theme === 'dark' 
                                ? 'bg-gray-800/50 border border-gray-700' 
                                : 'bg-gray-50 border border-gray-200'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                <Volume2 className="w-4 h-4 text-blue-500" />
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  Transcription:
                                </span>
                              </div>
                              <p className={`text-sm ${
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                {message.transcription}
                              </p>
                            </div>
                          )}
                          
                          {/* Audio Player */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <audio 
                                src={message.audioUrl} 
                                controls 
                                className="w-full max-w-md"
                                controlsList="nodownload"
                              />
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTime(message.voiceDuration || 0)}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Loading Animation for text/email messages */}
          {loading && !isProcessingVoice && (
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
              if (!prompt.trim() || !selectedChat) return;
              
              try {
                setLoading(true);
                const promptCopy = prompt;
                setPrompt("");
                
                // Add user message
                setMessages(prev => [
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
                    prompt
                  },
                  { headers: { Authorization: token } }
                );

                if (data.success) {
                  // Add AI response
                  const reply = {
                    ...data.reply,
                    timestamp: Date.now(),
                  };
                  setMessages(prev => [...prev, reply]);
                  
                  // Update user credits
                  const creditDeduction = mode === "email" ? 2 : 1;
                  setUser(prev => ({ 
                    ...prev, 
                    credits: Math.max(0, prev.credits - creditDeduction) 
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
                <option value="text">Text (1 credit)</option>
                <option value="email">Email (2 credits)</option>
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
                  disabled={isRecording || isProcessingVoice}
                />
                
                {/* Voice Button - Only show when not recording and not processing */}
                {!isRecording && !isProcessingVoice && (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={!selectedChat || user?.credits < 3}
                    className="absolute right-1.5 top-1/2 transform -translate-y-1/2 p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Record voice message (3 credits)"
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              {/* Send Button */}
              <button
                type="submit"
                disabled={loading || !prompt.trim() || !selectedChat || isRecording || isProcessingVoice}
                className={`px-3 py-1.5 rounded-lg transition-all shrink-0 flex items-center justify-center ${
                  loading || !prompt.trim() || !selectedChat || isRecording || isProcessingVoice
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
                  {mode === "email" ? "Email Mode (2 credits)" : "Chat Mode (1 credit)"}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                Credits: <span className={`font-semibold ${user?.credits < 3 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
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
        {!isRecording && !isProcessingVoice && (
          <div className="mt-2">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
              <span className="flex items-center justify-center gap-1">
                <Mic className="w-2.5 h-2.5" />
                Voice messages require 3 credits • Maximum 4MB
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;