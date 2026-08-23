import { z } from "zod";

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(12).max(128);

export const registerSchema = z.object({ email, password, displayName: z.string().trim().min(1).max(80) });
export const loginSchema = z.object({ email, password });
export const tokenSchema = z.object({ token: z.string().min(32).max(256) });
export const requestResetSchema = z.object({ email });
export const resetPasswordSchema = z.object({ token: z.string().min(32).max(256), password });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
