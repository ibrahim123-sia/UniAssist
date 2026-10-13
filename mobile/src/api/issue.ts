import client, { UPLOAD_TIMEOUT } from "./client";

export const apiListDepartments = () => client.get("/api/department");

export const apiListIssues = () => client.get("/api/issue/my");
export const apiGetIssue = (id: string) => client.get(`/api/issue/${id}`);
export const apiCreateIssue = (form: FormData) =>
  client.post("/api/issue", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: UPLOAD_TIMEOUT,
  });
export const apiStudentReply = (id: string, message: string) =>
  client.post(`/api/issue/${id}/reply`, { message });

// Rating 1-5 once the issue is Resolved/Closed; 409 if already rated.
export const MAX_FEEDBACK_CHARS = 1000;
export const apiIssueFeedback = (id: string, body: { rating: number; comment?: string }) =>
  client.post(`/api/issue/${id}/feedback`, body);

// "Register a complaint" from the chat. The suggestion may be null.
export const MAX_COMPLAINT_DETAILS_CHARS = 2000;
export const apiDepartmentSuggestion = (text: string) =>
  client.get("/api/issue/department-suggestion", { params: { text } });
// 201 { issue } on success; 409 { message, issue } when this chat already has
// an open complaint.
export const apiIssueFromChat = (body: { chatId: string; departmentId: string; details?: string }) =>
  client.post("/api/issue/from-chat", body);
