import client from "./client";

export const apiListNotifications = () => client.get("/api/notification");
export const apiUnreadCount = () => client.get("/api/notification/unread-count");
export const apiMarkRead = (id: string) => client.patch(`/api/notification/${id}/read`);
export const apiMarkAllRead = () => client.patch("/api/notification/read-all");
