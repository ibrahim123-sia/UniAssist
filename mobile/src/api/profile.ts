import client, { UPLOAD_TIMEOUT } from "./client";

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

// PATCH /api/user/profile accepts only a `name` field and an `avatar` image.
// `onProgress` gets 0-100 while the multipart body uploads.
export const apiUpdateProfile = (
  payload: { name?: string; avatar?: PickedFile },
  onProgress?: (percent: number) => void
) => {
  const fd = new FormData();
  if (payload.name !== undefined) fd.append("name", payload.name);
  if (payload.avatar) {
    // RN's FormData takes { uri, name, type } in place of a Blob.
    fd.append("avatar", payload.avatar as any);
  }
  return client.patch("/api/user/profile", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: UPLOAD_TIMEOUT,
    onUploadProgress: onProgress
      ? (e) => {
          if (e.total) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
        }
      : undefined,
  });
};

export const apiChangePassword = (currentPassword: string, newPassword: string) =>
  client.post("/api/user/change-password", { currentPassword, newPassword });
