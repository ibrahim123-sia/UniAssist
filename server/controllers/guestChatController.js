import Groq from "groq-sdk";

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// In-memory storage for guest sessions
const guestSessions = new Map();
const GUEST_SESSION_EXPIRY = 60 * 60 * 1000; // 1 hour

// Get or create guest session
const getOrCreateGuestSession = (sessionId) => {
  if (!guestSessions.has(sessionId)) {
    guestSessions.set(sessionId, {
      id: sessionId,
      messages: [],
      createdAt: Date.now(),
      lastActivity: Date.now()
    });
  }
  
  const session = guestSessions.get(sessionId);
  session.lastActivity = Date.now();
  
  // Cleanup old sessions periodically
  cleanupOldSessions();
  
  return session;
};

// Cleanup expired sessions
const cleanupOldSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of guestSessions.entries()) {
    if (now - session.lastActivity > GUEST_SESSION_EXPIRY) {
      guestSessions.delete(sessionId);
    }
  }
};

// Guest text chat controller (UNLIMITED MESSAGES)
export const guestTextChatController = async (req, res) => {
  try {
    const { message, sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message is required and must be a non-empty string.",
      });
    }

    // Get or create guest session
    const session = getOrCreateGuestSession(sessionId);
    
    // Add user message to session
    session.messages.push({
      role: "user",
      content: message.trim(),
      timestamp: Date.now(),
    });

    // Prepare messages for Groq (last 10 messages for context to manage token usage)
    const recentMessages = session.messages.slice(-10);
    const messagesForGroq = [
      {
        role: "system",
        content: `You are UniAssist, a helpful university assistant for MAJU University.
        Help students with academic queries, course information, assignment help, 
        email drafting, and university procedures. Be concise and accurate.
        
        Note: This is a guest user. They have unlimited messages but only text chat.
        Provide helpful responses and if appropriate, mention that signing up gives access to 
        voice chat, email drafting, and chat history saving.`
      },
      ...recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    // Call Groq API
    const completion = await groq.chat.completions.create({
      messages: messagesForGroq,
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 800,
      top_p: 0.9,
      stream: false,
    });

    const botReply = completion.choices[0]?.message?.content || 
      "I apologize, but I couldn't generate a response. Please try again.";

    // Add bot response to session
    session.messages.push({
      role: "assistant",
      content: botReply,
      timestamp: Date.now(),
    });

    // Save session
    guestSessions.set(sessionId, session);

    // Send response
    res.json({
      success: true,
      reply: {
        content: botReply,
        timestamp: Date.now(),
      },
      sessionId: sessionId,
      totalMessages: session.messages.length / 2, // Counts both user and bot messages
      note: "Guest users have unlimited text messages. Sign up for voice chat, email drafting, and saved chat history."
    });

  } catch (error) {
    console.error("Guest chat error:", error.message);
    
    res.status(500).json({
      success: false,
      message: "Sorry, there was an error processing your request. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get guest chat history
export const getGuestChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required.",
      });
    }

    const session = guestSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found or expired.",
      });
    }

    res.json({
      success: true,
      sessionId: sessionId,
      messages: session.messages,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      messageCount: session.messages.length
    });

  } catch (error) {
    console.error("Get guest history error:", error.message);
    res.status(500).json({
      success: false,
      message: "Error retrieving chat history.",
    });
  }
};

// Clear guest session
export const clearGuestSession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required.",
      });
    }

    if (guestSessions.has(sessionId)) {
      guestSessions.delete(sessionId);
    }

    res.json({
      success: true,
      message: "Session cleared successfully.",
    });

  } catch (error) {
    console.error("Clear session error:", error.message);
    res.status(500).json({
      success: false,
      message: "Error clearing session.",
    });
  }
};