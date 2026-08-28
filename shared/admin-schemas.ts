import { z } from "zod";

export const totpCodeSchema=z.string().regex(/^\d{6}$/);
export const adminMfaEnrollSchema=z.object({password:z.string().min(12).max(128)}).strict();
export const adminMfaActivateSchema=z.object({code:totpCodeSchema}).strict();
export const adminMfaVerifySchema=adminMfaActivateSchema;
export const adminReauthSchema=z.object({password:z.string().min(12).max(128),code:totpCodeSchema}).strict();
export const adminReasonSchema=z.string().trim().min(5).max(500);
export const adminUserMutationSchema=z.object({blocked:z.boolean(),reason:adminReasonSchema}).strict();
export const adminRevokeSessionsSchema=z.object({reason:adminReasonSchema}).strict();
export const adminModelMutationSchema=z.object({enabled:z.boolean(),reason:adminReasonSchema}).strict();
export const adminPriceMutationSchema=z.object({promptMicrosPerMillion:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),completionMicrosPerMillion:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),currency:z.string().regex(/^[A-Z]{3}$/),reason:adminReasonSchema}).strict();
export const adminFeatureFlagSchema=z.object({key:z.string().regex(/^[a-z][a-z0-9_.-]{2,79}$/),enabled:z.boolean(),description:z.string().trim().min(1).max(300),version:z.number().int().nonnegative(),reason:adminReasonSchema}).strict();
