import { iam } from "@/lib/api";
import { accessCodeHeader, type SessionUser } from "@/lib/auth";

// crypt-iam account endpoints (login / register / refresh live in lib/auth.tsx)
export const account = {
  me: () => iam<SessionUser>("/api/auth/me"),
  updateMe: (body: { name: string }) => iam<SessionUser>("/api/auth/me", { method: "PUT", body }),
  changePassword: (body: { oldPassword: string; newPassword: string }) =>
    iam<void>("/api/auth/change-password", { method: "POST", body }),
  resendVerifyEmail: () => iam<void>("/api/auth/verify-email/resend", { method: "POST" }),

  // Public (no session)
  sendResetPassword: (email: string) =>
    iam<void>("/api/auth/send-reset-password", { method: "POST", auth: false, headers: accessCodeHeader(), body: { email } }),
  resetPassword: (body: { resetToken: string; newPassword: string }) =>
    iam<void>("/api/auth/reset-password", { method: "POST", auth: false, body }),
  verifyEmail: (token: string) => iam<void>("/api/auth/verify-email", { auth: false, query: { token } }),
};
