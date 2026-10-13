import client from "./client";

export type QuestionStatus = "open" | "answered" | "dismissed";

export interface StudentQuestion {
  _id: string;
  question: string;
  botAnswer?: string | null;
  source: "auto" | "student";
  status: QuestionStatus;
  adminAnswer?: string | null;
  answeredAt?: string | null;
  createdAt: string;
}

// Server caps questions at 2000 characters.
export const MAX_QUESTION_CHARS = 2000;

// "Ask an admin" from the chat. An identical open question comes back (200)
// instead of being duplicated.
export const apiAskAdmin = (question: string, chatId?: string) =>
  client.post("/api/question", { question, ...(chatId ? { chatId } : {}) });

export const apiMyQuestions = () => client.get("/api/question/my");
