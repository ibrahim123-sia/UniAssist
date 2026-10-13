import client, { SLOW_REQUEST_TIMEOUT } from "./client";

export type ChatMode = "text" | "email";

export const apiListChats = () => client.get("/api/chat/all");
export const apiGetChat = (id: string) => client.get(`/api/chat/${id}`);
export const apiCreateChat = () => client.post("/api/chat/create");
export const apiDeleteChat = (chatId: string) =>
  client.delete("/api/chat/delete", { data: { chatId } });
export const apiRenameChat = (chatId: string, name: string) =>
  client.put("/api/chat/rename", { chatId, name });

// Returns { reply, userMessage, chatName } — the server names a fresh chat
// after its first question.
export const apiSendMessage = (chatId: string, prompt: string, mode: ChatMode = "text") =>
  client.post(`/api/message/${mode}`, { chatId, prompt }, { timeout: SLOW_REQUEST_TIMEOUT });

// Transcribe-only: the caller drops the text into the input for the user to
// edit, nothing is saved to the chat.
// Same body as the web: duration in seconds, fileSize in MB (as a string).
export const apiTranscribe = (audioDataUrl: string, duration: number, fileSizeBytes: number) =>
  client.post(
    "/api/message/transcribe",
    { audioUrl: audioDataUrl, duration, fileSize: (fileSizeBytes / (1024 * 1024)).toFixed(2) },
    { timeout: SLOW_REQUEST_TIMEOUT }
  );
