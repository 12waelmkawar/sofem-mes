import { z } from 'zod';

// ─── Auth Schemas ───────────────────────────────────────────────

export const loginSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4-8 digits'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const verify2faSchema = z.object({
  code: z.string().regex(/^\d{6}$/, '2FA code must be 6 digits'),
  remember_device: z.boolean().optional(),
});

export type Verify2faInput = z.infer<typeof verify2faSchema>;

export const createUserSchema = z.object({
  nom: z.string().min(1, 'Nom is required'),
  prenom: z.string().min(1, 'Prenom is required'),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR']),
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4-8 digits'),
  operateur_id: z.number().int().nullable().optional(),
  actif: z.boolean().optional().default(true),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  nom: z.string().min(1).optional(),
  prenom: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR']).optional(),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  actif: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPinSchema = z.object({
  new_pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4-8 digits'),
  force_change: z.boolean().optional().default(false),
});

export type ResetPinInput = z.infer<typeof resetPinSchema>;

export const changePinSchema = z.object({
  old_pin: z.string().regex(/^\d{4,8}$/).optional(),
  new_pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4-8 digits'),
});

export type ChangePinInput = z.infer<typeof changePinSchema>;

// ─── Session Schemas ────────────────────────────────────────────

export const revokeSessionSchema = z.object({});

// ─── Response Types ─────────────────────────────────────────────

export interface AuthResponse {
  role: string;
  nom: string;
  prenom: string;
  operateur_id: number | null;
  requires_2fa?: boolean;
  locked?: boolean;
  retry_after_seconds?: number;
  pin_must_change?: boolean;
}

export interface SessionInfo {
  id: number;
  user_id: number;
  user_nom: string;
  created_at: string;
  last_activity: string;
  ip_address: string | null;
  user_agent: string | null;
  is_current: boolean;
}

// ─── Standard Error Envelope ────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: { field: string; issue: string }[];
    request_id?: string;
  };
}
