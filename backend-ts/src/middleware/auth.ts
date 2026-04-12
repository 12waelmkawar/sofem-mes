import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    role: string;
    nom: string;
    prenom: string;
    operateur_id: number | null;
    sessionToken: string;
  };
}

// ─── JWT Authentication Middleware ──────────────────────────────

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[process.env.JWT_COOKIE_NAME || 'sofem_session'];

  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        request_id: res.getHeader('X-Request-ID') as string,
      },
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;

    // Check session blocklist (revoked sessions)
    req.user = {
      userId: payload.userId,
      role: payload.role,
      nom: payload.nom,
      prenom: payload.prenom,
      operateur_id: payload.operateur_id,
      sessionToken: payload.jti,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session',
        request_id: res.getHeader('X-Request-ID') as string,
      },
    });
  }
}

// ─── Role-Based Access Control ──────────────────────────────────

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Required role: ${roles.join(' or ')}`,
          request_id: res.getHeader('X-Request-ID') as string,
        },
      });
    }

    next();
  };
}

// ─── Optional Auth (sets user if present, doesn't block) ────────

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[process.env.JWT_COOKIE_NAME || 'sofem_session'];

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
      req.user = {
        userId: payload.userId,
        role: payload.role,
        nom: payload.nom,
        prenom: payload.prenom,
        operateur_id: payload.operateur_id,
        sessionToken: payload.jti,
      };
    } catch {
      // Token invalid — ignore, user stays unauthenticated
    }
  }

  next();
}

// ─── Session Management Helpers ─────────────────────────────────

export async function isSessionRevoked(sessionToken: string): Promise<boolean> {
  const { rows } = await query<{ count: string }>(
    'SELECT COUNT(*) FROM sessions WHERE session_token = $1 AND revoked_at IS NOT NULL',
    [sessionToken]
  );
  return parseInt(rows[0].count) > 0;
}

export async function recordSession(
  userId: number,
  sessionToken: string,
  ip_address?: string,
  user_agent?: string
): Promise<void> {
  await query(
    `INSERT INTO sessions (user_id, session_token, ip_address, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [userId, sessionToken, ip_address, user_agent]
  );
}

export async function revokeSession(sessionToken: string): Promise<void> {
  await query(
    'UPDATE sessions SET revoked_at = NOW() WHERE session_token = $1',
    [sessionToken]
  );
}

export async function revokeAllUserSessions(userId: number): Promise<void> {
  await query(
    'UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}

// ─── Rate Limiting for Login ────────────────────────────────────

const loginAttempts = new Map<string, { count: number; locked_until: Date }>();

export function checkLoginRateLimit(ip: string): { allowed: boolean; retry_after_seconds?: number } {
  const now = new Date();
  const entry = loginAttempts.get(ip);

  if (!entry) {
    return { allowed: true };
  }

  if (entry.locked_until > now) {
    const retryAfter = Math.ceil((entry.locked_until.getTime() - now.getTime()) / 1000);
    return { allowed: false, retry_after_seconds: retryAfter };
  }

  // Lock expired, reset
  loginAttempts.delete(ip);
  return { allowed: true };
}

export function recordFailedLogin(ip: string): void {
  const now = new Date();
  const entry = loginAttempts.get(ip);

  if (!entry) {
    loginAttempts.set(ip, { count: 1, locked_until: new Date(now.getTime() + 30000) }); // 30s after 1st
    return;
  }

  const newCount = entry.count + 1;

  let lockDuration = 0;
  if (newCount >= 10) lockDuration = 3600000;       // 1 hour after 10
  else if (newCount >= 5) lockDuration = 300000;     // 5 min after 5
  else if (newCount >= 3) lockDuration = 30000;      // 30s after 3

  if (lockDuration > 0) {
    loginAttempts.set(ip, {
      count: newCount,
      locked_until: new Date(now.getTime() + lockDuration),
    });
  } else {
    entry.count = newCount;
  }
}

export function recordSuccessfulLogin(ip: string): void {
  loginAttempts.delete(ip);
}
