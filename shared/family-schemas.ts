import { z } from "zod";

export const familyRoleSchema = z.enum(["admin", "guardian", "member", "child"]);
export const createFamilySchema = z.object({ name: z.string().trim().min(1).max(100) });
export const createInvitationSchema = z.object({ email: z.string().trim().email().max(254).optional(), userId: z.string().uuid().optional(), role: familyRoleSchema }).refine((value) => value.email || value.userId, "email or userId is required");
export const acceptInvitationSchema = z.object({ token: z.string().min(32).max(256), password: z.string().min(12).max(128) });
export const transferOwnershipSchema = z.object({ targetUserId: z.string().uuid() });
export const familySettingsSchema = z.object({
  version: z.number().int().positive(),
  values: z.object({
    aiEnabled: z.boolean().default(false),
    allowedModels: z.array(z.string().min(1).max(120)).max(20).default([]),
    monthlyTokenLimit: z.number().int().min(0).max(1_000_000_000).default(0),
    locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).default("ru"),
    timezone: z.string().min(1).max(80).default("Europe/Moscow"),
    notificationsEnabled: z.boolean().default(true),
    aiHistoryRetentionDays: z.number().int().min(0).max(365).default(0),
  }).strict(),
});
