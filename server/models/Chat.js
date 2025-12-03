// models/Chat.js
import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    name: { 
      type: String, 
      default: "New Chat" 
    },
    messages: [
      {
        type: {
          type: String,
          enum: ['text', 'email'],
          default: 'text'
        },
        role: { 
          type: String, 
          enum: ['user', 'assistant'], 
          required: true 
        },
        content: { 
          type: String, 
          required: true 
        },
        // For email automation only
        emailData: {
          recipient: String,
          subject: String,
          isSent: { type: Boolean, default: false }
        },
        timestamp: { 
          type: Date, 
          default: Date.now 
        },
      },
    ],
 
  },
  { 
    timestamps: true 
  }
);

// Index for faster chat retrieval
ChatSchema.index({ userId: 1, createdAt: -1 });

const Chat = mongoose.model("Chat", ChatSchema);
export default Chat;