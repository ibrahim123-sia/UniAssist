import client from "./client";

export const apiLogin = (email: string, password: string) =>
  client.post("/api/user/login", { email, password });

export const apiRegister = (name: string, email: string, password: string) =>
  client.post("/api/user/register", { name, email, password });

export const apiVerifyOtp = (email: string, otp: string) =>
  client.post("/api/user/verify-otp", { email, otp });

export const apiResendOtp = (email: string) =>
  client.post("/api/user/resend-otp", { email });

export const apiForgotPassword = (email: string) =>
  client.post("/api/user/forgot-password", { email });

export const apiResetPassword = (email: string, otp: string, newPassword: string) =>
  client.post("/api/user/reset-password", { email, otp, newPassword });

export const apiGetUser = () => client.get("/api/user/get");
