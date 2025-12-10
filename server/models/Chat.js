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
      },
    ],
  },
  { timestamps: true }
);

const Chat = mongoose.model("Chat", ChatSchema);

export default Chat;