import { z } from "zod";

export const Role = z.enum(["user", "admin"]);
export type Role = z.infer<typeof Role>;

export const KycStatus = z.enum(["not_started", "pending", "passed", "failed"]);
export type KycStatus = z.infer<typeof KycStatus>;

export const RegisterInput = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12).max(1024),
  displayName: z.string().min(1).max(120),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(1024),
  totpCode: z.string().length(6).regex(/^\d+$/).optional(),
});
export type LoginInput = z.infer<typeof LoginInput>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  mfaEnabled: boolean;
  kycStatus: KycStatus;
  createdAt: string;
}
