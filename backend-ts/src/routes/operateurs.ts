import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { parsePagination, logActivity, apiError } from '../utils/helpers.js';

const router = Router();

const createOperateurSchema = z.object({
  nom: z.string().min(1),
  prenom: z.string().min(1),
  specialite: z.string().default('Ponçage'),
  role: z.enum(['OPERATEUR', 'CHEF_ATELIER', 'RESPONSABLE', 'TECHNICIEN']).default('OPERATEUR'),
  telephone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  taux_horaire: z.coerce.number().default(0),
  taux_piece: z.coerce.number().default(0),
  type_taux: z.enum(['HORAIRE', 'PIECE', 'BOTH']).default('HORAIRE'),
});

const updateOperateurSchema = createOperateurSchema.partial();

// ─── GET /api/operateurs ───────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { limit, offset, sort, order, search } = parsePagination(req.query);
    const roleFilter = req.query.role as string | undefined;

    let where = 'WHERE o.actif = true';
    const params: any[] = [];
    let pIdx = 1;

    if (roleFilter) {
      params.push(roleFilter);
      where += ` AND o.role = $${pIdx++}`;
    }
    if (search) {
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      where += ` AND (o.nom ILIKE $${pIdx} OR o.prenom ILIKE $${pIdx + 1} OR o.specialite ILIKE $${pIdx + 2})`;
      pIdx += 3;
    }

    const countRes = await query<{ total: string }>(`SELECT COUNT(*) as total FROM operateurs o ${where}`, params);
    const total = parseInt(countRes.rows[0].total);

    const { rows } = await query(
      `SELECT * FROM operateurs o ${where} ORDER BY o.${sort} ${order} LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({ data: rows, pagination: { total, limit, offset, has_more: (offset || 0) + rows.length < total } });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get operateurs'));
  }
});

// ─── POST /api/operateurs ──────────────────────────────────────

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = createOperateurSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));
  }

  const { nom, prenom, specialite, role, telephone, email, taux_horaire, taux_piece, type_taux } = parsed.data;

  try {
    const { rows } = await query(
      `INSERT INTO operateurs (nom, prenom, specialite, role, telephone, email, taux_horaire, taux_piece, type_taux)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [nom, prenom, specialite, role, telephone || null, email || null, taux_horaire, taux_piece, type_taux]
    );

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'CREATE',
      entity_type: 'operateurs', entity_id: rows[0].id,
      detail: `Operator created: ${prenom} ${nom}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create operator'));
  }
});

// ─── PUT /api/operateurs/:id ───────────────────────────────────

router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = updateOperateurSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data'));

  const u = parsed.data;
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  const setIf = (k: string, v: any) => { if (v !== undefined) { fields.push(`${k} = $${idx++}`); values.push(v); } };

  setIf('nom', u.nom); setIf('prenom', u.prenom); setIf('specialite', u.specialite);
  setIf('role', u.role); setIf('telephone', u.telephone); setIf('email', u.email);
  setIf('taux_horaire', u.taux_horaire); setIf('taux_piece', u.taux_piece); setIf('type_taux', u.type_taux);

  if (fields.length === 0) return res.status(400).json(apiError('VALIDATION_ERROR', 'No fields to update'));
  values.push(req.params.id);

  try {
    const { rows } = await query(`UPDATE operateurs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'Operator not found'));

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'UPDATE',
      entity_type: 'operateurs', entity_id: rows[0].id,
      detail: `Operator updated: ${rows[0].prenom} ${rows[0].nom}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update operator'));
  }
});

// ─── DELETE /api/operateurs/:id ────────────────────────────────

router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query('UPDATE operateurs SET actif = false WHERE id = $1 RETURNING nom, prenom', [req.params.id]);
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'Operator not found'));

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'DEACTIVATE',
      entity_type: 'operateurs', entity_id: parseInt(req.params.id),
      detail: `Operator deactivated: ${rows[0].prenom} ${rows[0].nom}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.json({ message: 'Operator deactivated' });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to delete operator'));
  }
});

export { router as operateursRouter };

