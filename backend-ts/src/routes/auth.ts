import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { query, transaction } from '../db/pool.js';
import { AuthRequest, requireAuth, requireRole, recordSession, revokeSession, revokeAllUserSessions, checkLoginRateLimit, recordFailedLogin, recordSuccessfulLogin } from '../middleware/auth.js';
import { loginSchema, createUserSchema, updateUserSchema, resetPinSchema, changePinSchema, verify2faSchema } from '../schemas/auth.js';

const router = Router();
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'sofem_session';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

// ─── Helpers ────────────────────────────────────────────────────

function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: parseInt(JWT_EXPIRES_IN) * 3600 * 1000,
  });
}

function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: parseInt(JWT_EXPIRES_IN) * 3600 });
}

async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// Legacy SHA-256 migration
function legacySha256(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

function getClientIp(req: AuthRequest): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
}

// ─── POST /api/auth/login ──────────────────────────────────────

router.post('/login', async (req: AuthRequest, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid PIN', details: parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message })) },
    });
  }

  const { pin } = parsed.data;
  const ip = getClientIp(req);

  // Rate limit check
  const rateCheck = checkLoginRateLimit(ip);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Reessayez plus tard.', retry_after_seconds: rateCheck.retry_after_seconds },
      locked: true,
      retry_after_seconds: rateCheck.retry_after_seconds,
    });
  }

  try {
    // Find user by PIN (iterate all active users)
    const { rows: users } = await query<{
      id: number; nom: string; prenom: string; role: string;
      pin_hash: string; operateur_id: number | null; actif: boolean;
      pin_must_change: boolean; totp_enabled: boolean; totp_secret: string | null;
    }>('SELECT id, nom, prenom, role, pin_hash, operateur_id, actif, pin_must_change, totp_enabled, totp_secret FROM users WHERE actif = true');

    let matchedUser: any = null;

    for (const user of users) {
      let pinValid = false;

      // Try bcrypt first
      if (user.pin_hash.startsWith('$2')) {
        pinValid = await verifyPin(pin, user.pin_hash);
      } else {
        // Legacy SHA-256 — migrate on first successful login
        const legacyHash = legacySha256(pin);
        if (user.pin_hash === legacyHash) {
          pinValid = true;
          // Migrate to bcrypt
          const newHash = await hashPin(pin);
          await query('UPDATE users SET pin_hash = $1 WHERE id = $2', [newHash, user.id]);
        }
      }

      if (pinValid) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      recordFailedLogin(ip);
      // Log failed login attempt
      await query(
        'INSERT INTO failed_logins (attempted_pin_hash, ip_address, user_agent) VALUES ($1, $2, $3)',
        [legacySha256(pin), ip, req.headers['user-agent']]
      );
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'PIN incorrect' },
      });
    }

    // Check 2FA
    if (matchedUser.totp_enabled) {
      // Return partial auth — client must verify 2FA
      const tempToken = generateToken({
        userId: matchedUser.id,
        role: matchedUser.role,
        nom: matchedUser.nom,
        prenom: matchedUser.prenom,
        operateur_id: matchedUser.operateur_id,
        requires_2fa: true,
      });
      setAuthCookie(res, tempToken);
      return res.json({
        requires_2fa: true,
        role: matchedUser.role,
        nom: matchedUser.nom,
        prenom: matchedUser.prenom,
        operateur_id: matchedUser.operateur_id,
      });
    }

    // Full login — generate JWT
    const sessionToken = crypto.randomUUID();
    const token = generateToken({
      userId: matchedUser.id,
      role: matchedUser.role,
      nom: matchedUser.nom,
      prenom: matchedUser.prenom,
      operateur_id: matchedUser.operateur_id,
      jti: sessionToken,
    });

    setAuthCookie(res, token);
    recordSession(matchedUser.id, sessionToken, ip, req.headers['user-agent']);
    recordSuccessfulLogin(ip);

    res.json({
      role: matchedUser.role,
      nom: matchedUser.nom,
      prenom: matchedUser.prenom,
      operateur_id: matchedUser.operateur_id,
      pin_must_change: matchedUser.pin_must_change,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Login failed' },
    });
  }
});

// ─── POST /api/auth/verify-2fa ─────────────────────────────────

router.post('/verify-2fa', async (req: AuthRequest, res: Response) => {
  const parsed = verify2faSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid 2FA code' },
    });
  }

  // 2FA verification requires a TOTP library (e.g., speakeasy)
  // For now, placeholder — implement when 2FA is enabled
  res.status(501).json({
    error: { code: 'NOT_IMPLEMENTED', message: '2FA not yet configured' },
  });
});

// ─── POST /api/auth/logout ─────────────────────────────────────

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.sessionToken) {
      await revokeSession(req.user.sessionToken);
    }
    res.clearCookie(COOKIE_NAME);
    res.json({ message: 'Déconnecté' });
  } catch (err) {
    res.clearCookie(COOKIE_NAME);
    res.json({ message: 'Déconnecté' });
  }
});

// ─── GET /api/auth/me ──────────────────────────────────────────

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query<{
      id: number; role: string; nom: string; prenom: string;
      operateur_id: number | null; pin_must_change: boolean;
    }>('SELECT id, role, nom, prenom, operateur_id, pin_must_change FROM users WHERE id = $1', [req.user!.userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    const user = rows[0];
    res.json({
      userId: user.id,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
      operateur_id: user.operateur_id,
      pin_must_change: user.pin_must_change,
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get user' } });
  }
});

// ─── PUT /api/auth/me/pin ──────────────────────────────────────

router.put('/me/pin', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = changePinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid PIN data' },
    });
  }

  const { old_pin, new_pin } = parsed.data;

  try {
    // If pin_must_change is set, skip old PIN check
    const { rows } = await query<{ pin_hash: string; pin_must_change: boolean }>(
      'SELECT pin_hash, pin_must_change FROM users WHERE id = $1',
      [req.user!.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    if (!rows[0].pin_must_change && old_pin) {
      const valid = await verifyPin(old_pin, rows[0].pin_hash);
      if (!valid) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Old PIN incorrect' } });
      }
    }

    const newHash = await hashPin(new_pin);
    await query(
      'UPDATE users SET pin_hash = $1, pin_must_change = false WHERE id = $2',
      [newHash, req.user!.userId]
    );

    res.json({ message: 'PIN modifié avec succès' });
  } catch (err) {
    console.error('PIN change error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'PIN change failed' } });
  }
});

// ─── GET /api/auth/sessions ────────────────────────────────────

router.get('/sessions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'ADMIN';

    let sql: string;
    let params: any[];

    if (isAdmin) {
      sql = `
        SELECT s.id, s.user_id, u.nom as user_nom, s.created_at, s.last_activity,
               s.ip_address, s.user_agent, s.session_token
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.revoked_at IS NULL
        ORDER BY s.created_at DESC
      `;
      params = [];
    } else {
      sql = `
        SELECT s.id, s.user_id, u.nom as user_nom, s.created_at, s.last_activity,
               s.ip_address, s.user_agent, s.session_token
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.user_id = $1 AND s.revoked_at IS NULL
        ORDER BY s.created_at DESC
      `;
      params = [req.user!.userId];
    }

    const { rows } = await query(sql, params);

    const sessions = rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      user_nom: r.user_nom,
      created_at: r.created_at,
      last_activity: r.last_activity,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      is_current: r.session_token === req.user!.sessionToken,
    }));

    res.json(sessions);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get sessions' } });
  }
});

// ─── POST /api/auth/sessions/:sid/revoke ───────────────────────

router.post('/sessions/:sid/revoke', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { sid } = req.params;

    // Get the session to check ownership
    const { rows } = await query<{ user_id: number; session_token: string }>(
      'SELECT user_id, session_token FROM sessions WHERE id = $1 AND revoked_at IS NULL',
      [sid]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const session = rows[0];

    // Admin can revoke any, users can only revoke their own
    if (req.user!.role !== 'ADMIN' && session.user_id !== req.user!.userId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot revoke this session' } });
    }

    await revokeSession(session.session_token);
    res.json({ message: 'Session révoquée' });
  } catch (err) {
    console.error('Revoke session error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke session' } });
  }
});

// ─── POST /api/auth/users/:uid/reset-pin ───────────────────────

router.post('/users/:uid/reset-pin', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { uid } = req.params;
  const parsed = resetPinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid PIN data' },
    });
  }

  const { new_pin, force_change } = parsed.data;

  try {
    // Check target user exists and role restrictions
    const { rows } = await query<{ id: number; role: string }>(
      'SELECT id, role FROM users WHERE id = $1',
      [uid]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    const targetUser = rows[0];

    // MANAGER can only reset OPERATOR PINs
    if (req.user!.role === 'MANAGER' && targetUser.role !== 'OPERATOR') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot reset this user\'s PIN' } });
    }

    const newHash = await hashPin(new_pin);
    await query(
      'UPDATE users SET pin_hash = $1, pin_must_change = $2 WHERE id = $3',
      [newHash, force_change, uid]
    );

    res.json({ message: 'PIN réinitialisé' });
  } catch (err) {
    console.error('PIN reset error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'PIN reset failed' } });
  }
});

// ─── GET /api/auth/users ───────────────────────────────────────

router.get('/users', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.nom, u.prenom, u.role, u.operateur_id, u.actif, u.pin_must_change, u.created_at,
              o.nom as operateur_nom, o.prenom as operateur_prenom
       FROM users u
       LEFT JOIN operateurs o ON o.id = u.operateur_id
       ORDER BY u.created_at DESC`
    );

    const users = rows.map(r => ({
      ...r,
      operateur: r.operateur_nom ? `${r.operateur_prenom} ${r.operateur_nom}` : null,
    }));

    res.json({ data: users, total: users.length });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get users' } });
  }
});

// ─── POST /api/auth/users ──────────────────────────────────────

router.post('/users', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid user data', details: parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message })) },
    });
  }

  const { nom, prenom, role, pin, operateur_id, actif } = parsed.data;

  try {
    const pinHash = await hashPin(pin);
    const { rows } = await query(
      `INSERT INTO users (nom, prenom, role, pin_hash, operateur_id, actif)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [nom, prenom, role, pinHash, operateur_id || null, actif]
    );

    res.status(201).json({ id: rows[0].id, message: 'Utilisateur créé' });
  } catch (err: any) {
    console.error('Create user error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create user' } });
  }
});

// ─── PUT /api/auth/users/:uid ──────────────────────────────────

router.put('/users/:uid', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid user data' },
    });
  }

  const updates = parsed.data;
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.nom !== undefined) { fields.push(`nom = $${idx++}`); values.push(updates.nom); }
  if (updates.prenom !== undefined) { fields.push(`prenom = $${idx++}`); values.push(updates.prenom); }
  if (updates.role !== undefined) { fields.push(`role = $${idx++}`); values.push(updates.role); }
  if (updates.actif !== undefined) { fields.push(`actif = $${idx++}`); values.push(updates.actif); }
  if (updates.pin !== undefined) {
    fields.push(`pin_hash = $${idx++}`);
    values.push(await hashPin(updates.pin));
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } });
  }

  values.push(req.params.uid);

  try {
    await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );

    res.json({ message: 'Utilisateur modifié' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' } });
  }
});

// ─── DELETE /api/auth/users/:uid ───────────────────────────────

router.delete('/users/:uid', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    // Soft delete
    await query('UPDATE users SET actif = false WHERE id = $1', [req.params.uid]);
    res.json({ message: 'Utilisateur désactivé' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' } });
  }
});

export { router as authRouter };
