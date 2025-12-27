import { createContext, useContext, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

// Use Vite environment variable
axios.defaults.baseURL =
  import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

// Email validation regex
// Format: sp/fa + (20-26) + (bscs|bsai|bsse|bsbc) + (0000-9999) + @maju.edu.pk
const MAJU_EMAIL_REGEX =
  /^(sp|fa)(2[0-6])(bscs|bsai|bsse|bsbc)([0-9]{4})@maju\.edu\.pk$/i;

// Helper function to validate MAJU email
const validateMajuEmail = (email) => {
  const trimmedEmail = email?.trim().toLowerCase();

  if (!trimmedEmail) {
    return { isValid: false, error: "Email is required" };
  }

  const match = trimmedEmail.match(MAJU_EMAIL_REGEX);

  if (!match) {
    return {
      isValid: false,
      error: "Use format: sp23bscs0178@maju.edu.pk",
    };
  }

  return {
    isValid: true,
    email: trimmedEmail,
  };
};

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
  const [guestSessionId, setGuestSessionId] = useState(
    localStorage.getItem("guestSessionId") || null
  );
  const [guestMessages, setGuestMessages] = useState([]);

  // ========== AUTHENTICATION FUNCTIONS ==========

  const registerUser = async (name, email, password) => {
    try {
      const nameRegex = /^[A-Za-z\s]+$/;
      if (!nameRegex.test(name)) {
        return {
          success: false,
          message: "Name should contain only alphabets and spaces",
        };
      }
      // Frontend validation
      if (!name || name.length < 2) {
        return {
          success: false,
          message: "Name must be at least 2 characters",
        };
      }

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: emailValidation.error };
      }

      if (!password || password.length < 6) {
        return {
          success: false,
          message: "Password must be at least 6 characters",
        };
      }

      const { data } = await axios.post("/api/user/register", {
        name,
        email: emailValidation.email,
        password,
      });

      if (data.success) {
        return { success: true, email: emailValidation.email };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      let errorMessage = "Registration failed";

      if (error.response?.status === 400) {
        errorMessage = error.response?.data?.message || "Invalid data";
      } else if (error.response?.status === 409) {
        errorMessage = "User already exists";
      } else if (error.response?.status === 429) {
        errorMessage = "Too many attempts";
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      return { success: false, message: errorMessage };
    }
  };

  const verifyOtp = async (email, otp) => {
    try {
      if (!email || !otp) {
        return { success: false, message: "Email and OTP are required" };
      }

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid email format" };
      }

      const cleanOtp = otp.toString().replace(/\s/g, "");
      if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
        return { success: false, message: "OTP must be 6 digits" };
      }

      const { data } = await axios.post("/api/user/verify-otp", {
        email: emailValidation.email,
        otp: cleanOtp,
      });

      if (data.success) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser(data.user);
        setLoadingUser(false);

        setTimeout(() => {
          navigate("/chat", { replace: true });
        }, 100);

        return { success: true, user: data.user };
      } else {
        return {
          success: false,
          message: data.message,
          attemptsRemaining: data.attemptsRemaining,
          requiresNewOtp: data.requiresNewOtp,
        };
      }
    } catch (error) {
      let errorMessage = "Verification failed";

      if (error.response?.status === 400) {
        errorMessage = error.response?.data?.message || "Invalid OTP";
      } else if (error.response?.status === 404) {
        errorMessage = "User not found";
      } else if (error.response?.status === 429) {
        errorMessage = "Too many attempts";
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
    }
  };

  const resendOtp = async (email) => {
    try {
      if (!email) {
        return { success: false, message: "Email is required" };
      }

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid email format" };
      }

      const { data } = await axios.post("/api/user/resend-otp", {
        email: emailValidation.email,
      });

      if (data.success) {
        return { success: true };
      } else {
        return {
          success: false,
          message: data.message,
          retryAfter: data.retryAfter,
        };
      }
    } catch (error) {
      let errorMessage = "Failed to resend OTP";

      if (error.response?.status === 400) {
        errorMessage = "Invalid email";
      } else if (error.response?.status === 404) {
        errorMessage = "User not found";
      } else if (error.response?.status === 429) {
        errorMessage = "Too many attempts";
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
    }
  };

  const loginUser = async (email, password) => {
    try {
      if (!email || !password) {
        return { success: false, message: "Email and password required" };
      }

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid email format" };
      }

      const { data } = await axios.post("/api/user/login", {
        email: emailValidation.email,
        password,
      });

      if (data.success) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser(data.user);
        setLoadingUser(false);

        if (guestSessionId) {
          clearGuestSession();
        }

        setTimeout(() => {
          navigate("/chat", { replace: true });
        }, 100);

        return { success: true, user: data.user };
      } else {
        return {
          success: false,
          message: data.message,
          attemptsRemaining: data.attemptsRemaining,
          needsVerification: data.needsVerification,
          email: emailValidation.email,
        };
      }
    } catch (error) {
      let errorMessage = "Login failed";

      if (error.response?.status === 400) {
        errorMessage = "Invalid input";
      } else if (error.response?.status === 401) {
        errorMessage = "Invalid email or password";
      } else if (error.response?.status === 403) {
        errorMessage = "Please verify your email first";
        return {
          success: false,
          message: errorMessage,
          needsVerification: true,
          email,
        };
      } else if (error.response?.status === 429) {
        errorMessage = "Account locked";
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
    }
  };

  const forgotPassword = async (email) => {
    try {
      if (!email) {
        return { success: false, message: "Email is required" };
      }

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid email format" };
      }

      const { data } = await axios.post("/api/user/forgot-password", {
        email: emailValidation.email,
      });

      if (data.success) {
        return { success: true, email: emailValidation.email };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      let errorMessage = "Failed to send reset OTP";

      if (error.response?.status === 400) {
        errorMessage = "Invalid email";
      } else if (error.response?.status === 429) {
        errorMessage = "Too many attempts";
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
    }
  };

  const resetPassword = async (email, otp, newPassword) => {
    try {
      if (!email || !otp || !newPassword) {
        return { success: false, message: "All fields are required" };
      }

      const emailValidation = validateMajuEmail(email);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid email format" };
      }

      if (newPassword.length < 6) {
        return {
          success: false,
          message: "Password must be at least 6 characters",
        };
      }

      const cleanOtp = otp.toString().replace(/\s/g, "");
      if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
        return { success: false, message: "OTP must be 6 digits" };
      }

      const { data } = await axios.post("/api/user/reset-password", {
        email: emailValidation.email,
        otp: cleanOtp,
        newPassword,
      });

      if (data.success) {
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 2000);
        return { success: true };
      } else {
        return {
          success: false,
          message: data.message,
          attemptsRemaining: data.attemptsRemaining,
        };
      }
    } catch (error) {
      let errorMessage = "Failed to reset password";

      if (error.response?.status === 400) {
        errorMessage = "Invalid input";
      } else if (error.response?.status === 404) {
        errorMessage = "User not found";
      } else if (error.response?.status === 429) {
        errorMessage = "Too many attempts";
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

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
        if (
          data.message?.includes("Not authorized") ||
          data.message?.includes("Invalid token")
        ) {
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
        }
        setLoadingUser(false);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      }
      setLoadingUser(false);
    }
  }, [token]);

  // ========== CHAT FUNCTIONS ==========

  const createNewChat = async () => {
    try {
      if (!user) {
        return { success: false, message: "Please login first" };
      }

      const { data } = await axios.post(
        "/api/chat/create",
        {},
        {
          headers: { Authorization: token },
        }
      );

      if (data.success) {
        await fetchUsersChats();
        return { success: true, chatId: data.chatId };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      let errorMessage = "Failed to create chat";

      if (error.response?.status === 401) {
        errorMessage = "Session expired";
        logout();
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
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
      }
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
      }
    }
  };

  const deleteChat = async (chatId) => {
    try {
      const { data } = await axios.delete("/api/chat/delete", {
        headers: { Authorization: token },
        data: { chatId },
      });

      if (data.success) {
        await fetchUsersChats();
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      let errorMessage = "Failed to delete chat";

      if (error.response?.status === 401) {
        errorMessage = "Session expired";
        logout();
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
    }
  };

  // ========== GUEST CHAT FUNCTIONS ==========

  const sendGuestMessage = async (message) => {
    try {
      if (!message || message.trim().length === 0) {
        return { success: false, message: "Message cannot be empty" };
      }

      const { data } = await axios.post("/api/guest/chat", {
        message: message.trim(),
        sessionId: guestSessionId,
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
            type: "text",
          },
          {
            role: "assistant",
            content: data.reply.content,
            timestamp: data.reply.timestamp,
            type: "text",
          },
        ];
        setGuestMessages(newMessages);

        return {
          success: true,
          reply: data.reply,
          sessionId: data.sessionId,
          messagesRemaining: data.messagesRemaining,
          note: data.note,
        };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      let errorMessage = "Failed to send message";

      if (error.response?.status === 429) {
        errorMessage = "Too many messages";
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
    }
  };

  const fetchGuestChatHistory = async (sessionId = guestSessionId) => {
    try {
      if (!sessionId) {
        return { success: false, message: "No session ID" };
      }

      const { data } = await axios.get(
        `/api/guest/history?sessionId=${sessionId}`
      );

      if (data.success) {
        setGuestMessages(data.messages || []);
        return {
          success: true,
          messages: data.messages,
          sessionId: data.sessionId,
          messageCount: data.messageCount,
        };
      } else {
        if (
          data.message?.includes("expired") ||
          data.message?.includes("not found")
        ) {
          clearGuestSession();
        }
        return { success: false, message: data.message };
      }
    } catch (error) {
      clearGuestSession();
      return { success: false, message: error.message };
    }
  };

  const clearGuestSession = async () => {
    try {
      if (guestSessionId) {
        try {
          await axios.post("/api/guest/clear", {
            sessionId: guestSessionId,
          });
        } catch (clearError) {
          console.log("Server session clear failed:", clearError.message);
        }
      }

      localStorage.removeItem("guestSessionId");
      setGuestSessionId(null);
      setGuestMessages([]);

      return { success: true };
    } catch (error) {
      localStorage.removeItem("guestSessionId");
      setGuestSessionId(null);
      setGuestMessages([]);
      return { success: true };
    }
  };

  const startNewGuestSession = () => {
    clearGuestSession();
  };

  // ========== MESSAGE FUNCTIONS ==========

  const sendTextMessage = async (chatId, prompt) => {
    try {
      if (!user) {
        return { success: false, message: "Please login to continue" };
      }

      if (!prompt || prompt.trim().length === 0) {
        return { success: false, message: "Message cannot be empty" };
      }

      const { data } = await axios.post(
        "/api/message/text",
        { chatId, prompt },
        { headers: { Authorization: token } }
      );
      return data;
    } catch (error) {
      let errorMessage = "Failed to send message";

      if (error.response?.status === 401) {
        errorMessage = "Session expired";
        logout();
      } else if (error.response?.status === 402) {
        errorMessage = "Insufficient credits";
      } else if (error.response?.status === 429) {
        errorMessage = "Too many requests";
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
    }
  };

  const sendEmailMessage = async (chatId, prompt, recipient, subject) => {
    try {
      if (!user) {
        return { success: false, message: "Please login to continue" };
      }

      const emailValidation = validateMajuEmail(recipient);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid recipient email" };
      }

      if (!prompt || prompt.trim().length === 0) {
        return { success: false, message: "Email content cannot be empty" };
      }

      if (!subject || subject.trim().length === 0) {
        return { success: false, message: "Email subject cannot be empty" };
      }

      const { data } = await axios.post(
        "/api/message/email",
        { chatId, prompt, recipient: emailValidation.email, subject },
        { headers: { Authorization: token } }
      );
      return data;
    } catch (error) {
      let errorMessage = "Failed to send email";

      if (error.response?.status === 401) {
        errorMessage = "Session expired";
        logout();
      } else if (error.response?.status === 402) {
        errorMessage = "Insufficient credits";
      } else if (error.response?.status === 400) {
        errorMessage = "Invalid email data";
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
    }
  };

  const sendVoiceMessage = async (chatId, audioUrl, duration, fileSize) => {
    try {
      if (!user) {
        return { success: false, message: "Please login to continue" };
      }

      if (!audioUrl || audioUrl.length === 0) {
        return { success: false, message: "Audio file is required" };
      }

      if (fileSize > 10 * 1024 * 1024) {
        return { success: false, message: "Audio file too large (max 10MB)" };
      }

      const { data } = await axios.post(
        "/api/message/voice",
        {
          chatId,
          audioUrl,
          duration,
          fileSize,
        },
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      return data;
    } catch (error) {
      let errorMessage = "Failed to send voice message";

      if (error.response?.status === 413) {
        errorMessage = "Audio file too large";
      } else if (error.response?.status === 400) {
        errorMessage = "Invalid audio format";
      } else if (error.response?.status === 401) {
        errorMessage = "Session expired";
        logout();
      } else if (error.response?.status === 402) {
        errorMessage = "Insufficient credits";
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
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
        return { success: false, message: data.message };
      }
    } catch (error) {
      let errorMessage = "Failed to load plans";

      if (error.response?.status === 401) {
        errorMessage = "Session expired";
        logout();
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
    }
  };

  const purchasePlan = async (planId) => {
    try {
      const { data } = await axios.post(
        "/api/credit/purchase",
        { planId },
        { headers: { Authorization: token } }
      );
      if (data.success) {
        window.location.href = data.url;
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      let errorMessage = "Failed to process purchase";

      if (error.response?.status === 401) {
        errorMessage = "Session expired";
        logout();
      } else if (error.code === "ERR_NETWORK") {
        errorMessage = "Network error";
      }

      return { success: false, message: errorMessage };
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
        return { success: false, message: data.message };
      }
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return { success: false, message: "Session expired" };
      }

      return { success: false, message: error.message };
    }
  };

  // ========== UTILITY FUNCTIONS ==========

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setChats([]);
    setSelectedChat(null);
    clearGuestSession();
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
      fetchGuestChatHistory();
    }
  }, [guestSessionId, user]);

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

    // Credits
    getCreditPlans,
    purchasePlan,
    getCreditBalance,

    // Email validation (export for components to use)
    validateMajuEmail,

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
