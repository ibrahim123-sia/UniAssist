import { createContext, useContext, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

// Use Vite environment variable
axios.defaults.baseURL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

const AppContext = createContext();

export const AppContextProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loadingUser, setLoadingUser] = useState(true);
  
  // Guest chat state
  const [guestSessionId, setGuestSessionId] = useState(localStorage.getItem("guestSessionId") || null);
  const [guestMessages, setGuestMessages] = useState([]);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [recordingTimer, setRecordingTimer] = useState(null);

  // ========== AUTHENTICATION FUNCTIONS ==========

  const registerUser = async (name, email, password) => {
    try {
      const { data } = await axios.post("/api/user/register", {
        name,
        email,
        password,
      });
      if (data.success) {
        return { success: true, email };
      } else {
        toast.error(data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return { success: false, message: error.message };
    }
  };

  const verifyOtp = async (email, otp) => {
    try {
      const { data } = await axios.post("/api/user/verify-otp", { email, otp });
      if (data.success) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser(data.user);
        setLoadingUser(false);
        toast.success(data.message);
        
        setTimeout(() => {
          navigate("/chat", { replace: true });
        }, 100);
        
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    }
  };

  const resendOtp = async (email) => {
    try {
      const { data } = await axios.post("/api/user/resend-otp", { email });
      if (data.success) {
        toast.success(data.message);
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return { success: false, message: error.message };
    }
  };

  const loginUser = async (email, password) => {
    try {
      const { data } = await axios.post("/api/user/login", { email, password });
      if (data.success) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser(data.user);
        setLoadingUser(false);
        
        if (guestSessionId) {
          clearGuestSession();
        }
        
        toast.success("Login successful!");
        
        setTimeout(() => {
          navigate("/chat", { replace: true });
        }, 100);
        
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Login failed";
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const { data } = await axios.post("/api/user/forgot-password", { email });
      if (data.success) {
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      return { success: false, message: errorMessage };
    }
  };

  const resetPassword = async (email, otp, newPassword) => {
    try {
      const { data } = await axios.post("/api/user/reset-password", {
        email,
        otp,
        newPassword,
      });
      if (data.success) {
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      return { success: false, message: errorMessage };
    }
  };

  // ========== USER FUNCTIONS ==========

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/user/get", {
        headers: { Authorization: token },
      });
      if (data.success) {
        setUser(data.user);
        setLoadingUser(false);
      } else {
        if (data.message?.includes("Not authorized") || data.message?.includes("Invalid token")) {
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
        }
        setLoadingUser(false);
        toast.error(data.message);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      } else {
        toast.error(error.message);
      }
      setLoadingUser(false);
    }
  }, [token]);

  // ========== CHAT FUNCTIONS ==========

  const createNewChat = async () => {
    try {
      if (!user) {
        toast.error("Login to create new chat");
        return { success: false, message: "Login required" };
      }
      
      const { data } = await axios.post("/api/chat/create", 
        {}, 
        {
          headers: { Authorization: token },
        }
      );

      if (data.success) {
        await fetchUsersChats();
        return { success: true, chatId: data.chatId };
      } else {
        toast.error(data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false, message: error.message };
    }
  };

  const fetchUsersChats = async () => {
    try {
      if (!token || !user) return;

      const { data } = await axios.get("/api/chat/all", {
        headers: { Authorization: token },
      });

      if (data.success) {
        setChats(data.chats);
        if (data.chats.length === 0) {
          await createNewChat();
          return fetchUsersChats();
        } else {
          setSelectedChat(data.chats[0]);
        }
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteChat = async (chatId) => {
    try {
      const { data } = await axios.delete("/api/chat/delete", {
        headers: { Authorization: token },
        data: { chatId }
      });
      
      if (data.success) {
        toast.success("Chat deleted");
        await fetchUsersChats();
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      toast.error(error.message);
      return { success: false, message: error.message };
    }
  };

  // ========== GUEST CHAT FUNCTIONS ==========

  const sendGuestMessage = async (message) => {
    try {
      if (!message || message.trim().length === 0) {
        toast.error("Message cannot be empty");
        return { success: false, message: "Message cannot be empty" };
      }

      const { data } = await axios.post("/api/guest/chat", {
        message: message.trim(),
        sessionId: guestSessionId
      });

      if (data.success) {
        if (!guestSessionId && data.sessionId) {
          localStorage.setItem("guestSessionId", data.sessionId);
          setGuestSessionId(data.sessionId);
        }

        const newMessages = [
          ...guestMessages,
          { 
            role: "user", 
            content: message.trim(), 
            timestamp: Date.now(),
            type: "text"
          },
          { 
            role: "assistant", 
            content: data.reply.content, 
            timestamp: data.reply.timestamp,
            type: "text"
          }
        ];
        setGuestMessages(newMessages);

        return {
          success: true,
          reply: data.reply,
          sessionId: data.sessionId,
          messagesRemaining: data.messagesRemaining,
          note: data.note
        };
      } else {
        toast.error(data.message || "Failed to send message");
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error("Guest chat error:", error);
      const errorMessage = error.response?.data?.message || "Error sending message. Please try again.";
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    }
  };

  const fetchGuestChatHistory = async (sessionId = guestSessionId) => {
    try {
      if (!sessionId) {
        console.log("No guest session ID found");
        return { success: false, message: "No session ID" };
      }

      console.log("Fetching guest history for session:", sessionId);
      const { data } = await axios.get(`/api/guest/history?sessionId=${sessionId}`);

      if (data.success) {
        setGuestMessages(data.messages || []);
        return { 
          success: true, 
          messages: data.messages,
          sessionId: data.sessionId,
          messageCount: data.messageCount
        };
      } else {
        if (data.message?.includes("expired") || data.message?.includes("not found")) {
          clearGuestSession();
        }
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error("Fetch guest history error:", error);
      clearGuestSession();
      return { success: false, message: error.message };
    }
  };

  const clearGuestSession = async () => {
    try {
      if (guestSessionId) {
        try {
          await axios.post("/api/guest/clear", {
            sessionId: guestSessionId
          });
        } catch (clearError) {
          console.log("Server session clear failed, but local session will be cleared:", clearError.message);
        }
      }

      localStorage.removeItem("guestSessionId");
      setGuestSessionId(null);
      setGuestMessages([]);

      toast.success("Guest session cleared");
      return { success: true };
    } catch (error) {
      console.error("Clear guest session error:", error);
      localStorage.removeItem("guestSessionId");
      setGuestSessionId(null);
      setGuestMessages([]);
      return { success: true };
    }
  };

  const startNewGuestSession = () => {
    clearGuestSession();
    toast.success("New guest chat started");
  };

  // ========== MESSAGE FUNCTIONS ==========

  const sendTextMessage = async (chatId, prompt) => {
    try {
      if (!user) {
        toast.info("Please login to use this feature");
        return { success: false, message: "Login required" };
      }
      
      const { data } = await axios.post("/api/message/text", 
        { chatId, prompt },
        { headers: { Authorization: token } }
      );
      return data;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return { success: false, message: error.message };
    }
  };

  const sendEmailMessage = async (chatId, prompt, recipient, subject) => {
    try {
      if (!user) {
        toast.info("Please login to use email features");
        return { success: false, message: "Login required" };
      }
      
      const { data } = await axios.post("/api/message/email", 
        { chatId, prompt, recipient, subject },
        { headers: { Authorization: token } }
      );
      return data;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return { success: false, message: error.message };
    }
  };

  // Voice message function - sends audio, gets transcription and response
  const sendVoiceMessage = async (chatId, audioBlob, duration, fileSize) => {
    try {
      if (!user) {
        toast.info("Please login to use voice features");
        return { success: false, message: "Login required" };
      }

      // Convert blob to base64
      const audioUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          resolve(reader.result); // This is the base64 string
        };
        reader.onerror = reject;
      });

      console.log("Sending voice message:", {
        chatId,
        duration,
        fileSize,
        audioSize: audioBlob.size
      });

      const { data } = await axios.post("/api/message/voice", 
        { 
          chatId, 
          audioUrl, // Send base64 string
          duration, 
          fileSize 
        },
        { 
          headers: { 
            Authorization: token,
            'Content-Type': 'application/json'
          } 
        }
      );

      return data;
    } catch (error) {
      console.error("Voice message error:", error);
      toast.error(error.response?.data?.message || error.message || "Failed to send voice message");
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || "Failed to send voice message" 
      };
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      setAudioChunks([]);
      setRecordingTime(0);
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };
      
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      // Start timer
      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setRecordingTimer(timer);
      
      return { success: true };
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Microphone access denied or not available");
      return { success: false, message: "Microphone access denied" };
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }
      
      return { success: true };
    }
    return { success: false, message: "No active recording" };
  };

  const getRecordedAudio = () => {
    if (audioChunks.length === 0) {
      return null;
    }
    
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    return {
      blob: audioBlob,
      duration: recordingTime,
      fileSize: audioBlob.size / (1024 * 1024), // MB
      url: URL.createObjectURL(audioBlob)
    };
  };

  const clearRecording = () => {
    setAudioChunks([]);
    setRecordingTime(0);
    setIsRecording(false);
    
    if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  };

  // ========== CREDIT FUNCTIONS ==========

  const getCreditPlans = async () => {
    try {
      const { data } = await axios.get("/api/credit/plans", {
        headers: { Authorization: token },
      });
      if (data.success) {
        return { success: true, plans: data.plans };
      } else {
        toast.error(data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return { success: false, message: error.message };
    }
  };

  const purchasePlan = async (planId) => {
    try {
      const { data } = await axios.post("/api/credit/purchase", 
        { planId },
        { headers: { Authorization: token } }
      );
      if (data.success) {
        window.location.href = data.url;
        return { success: true };
      } else {
        toast.error(data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return { success: false, message: error.message };
    }
  };

  const getCreditBalance = async () => {
    try {
      const { data } = await axios.get("/api/credit/balance", {
        headers: { Authorization: token },
      });
      if (data.success) {
        setUser((prev) => ({ ...prev, credits: data.credits }));
        return { success: true, credits: data.credits };
      } else {
        toast.error(data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return { success: false, message: error.message };
    }
  };

  // ========== UTILITY FUNCTIONS ==========

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setChats([]);
    setSelectedChat(null);
    toast.success("Logged out successfully");
    navigate("/login", { replace: true });
  };

  // ========== USE EFFECTS ==========

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    if (user && token) {
      fetchUsersChats();
    } else {
      setChats([]);
      setSelectedChat(null);
    }
  }, [user, token]);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setUser(null);
      setLoadingUser(false);
    }
  }, [token, fetchUser]);

  useEffect(() => {
    if (guestSessionId && !user) {
      console.log("Loading guest session:", guestSessionId);
      fetchGuestChatHistory();
    }
  }, [guestSessionId, user]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
    };
  }, [recordingTimer]);

  // ========== CONTEXT VALUE ==========

  const value = {
    // State
    navigate,
    user,
    setUser,
    chats,
    setChats,
    selectedChat,
    setSelectedChat,
    theme,
    token,
    loadingUser,
    location,
    
    // Guest State
    guestSessionId,
    setGuestSessionId,
    guestMessages,
    setGuestMessages,
    
    // Voice Recording State
    isRecording,
    recordingTime,
    mediaRecorder,
    audioChunks,
    
    // Utility
    setTheme,
    toggleTheme,
    logout,
    
    // Authentication
    registerUser,
    verifyOtp,
    resendOtp,
    loginUser,
    forgotPassword,
    resetPassword,
    
    // User
    fetchUser,
    
    // Chat
    createNewChat,
    fetchUsersChats,
    deleteChat,
    
    // Guest Chat
    sendGuestMessage,
    fetchGuestChatHistory,
    clearGuestSession,
    startNewGuestSession,
    
    // Messages
    sendTextMessage,
    sendEmailMessage,
    sendVoiceMessage,
    
    // Voice Recording Functions
    startRecording,
    stopRecording,
    getRecordedAudio,
    clearRecording,
    
    // Credits
    getCreditPlans,
    purchasePlan,
    getCreditBalance,
    
    // Axios
    axios,
  };
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppContextProvider");
  }
  return context;
};