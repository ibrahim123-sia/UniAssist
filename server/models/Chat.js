import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    userName: { 
      type: String, 
      required: true 
    },
    name: { 
      type: String, 
      required: true,
      default: "New Chat" 
    },
    messages: [
      {
        type: {
          type: String,
          enum: ['text', 'email', 'voice'],
          default: 'text'
        },
        role: { 
          type: String, 
          required: true 
        },
        content: { 
          type: String, 
          required: true 
        },
        emailData: {
          recipient: String,
          subject: String,
          isSent: { type: Boolean, default: false }
        },
        voiceNote: {
          audioUrl: String,
          duration: Number,
          fileSize: Number
        },
        timestamp: { 
          type: Number, 
          required: true 
        },
        // Assistant replies only: false when the bot couldn't answer, and the
        // UnansweredQuestion it was forwarded to (so the note survives reloads).
        answered: { type: Boolean, default: undefined },
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: "UnansweredQuestion", default: undefined },
        // Student chats only: the question looked like a personal complaint,
        // so clients highlight "Register a complaint".
        suggestComplaint: { type: Boolean, default: undefined },
      },
    ],
  },
  { timestamps: true }
);

const Chat = mongoose.model("Chat", ChatSchema);

export default Chat;