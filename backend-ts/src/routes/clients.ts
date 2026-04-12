import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { nextCode, parsePagination, logActivity, apiError } from '../utils/helpers.js';

const router = Router();

const createClientSchema = z.object({
  nom: z.string().min(1, 'Nom is required'),
  matricule_fiscal: z.string().nullable().optional(),
  telephone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  adresse: z.string().nullable().optional(),
  ville: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const updateClientSchema = createClientSchema.partial();

// ─── GET /api/clients ──────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { limit, offset, sort, order, search } = parsePagination(req.query);

    let where = 'WHERE c.actif = true';
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      where += ' AND (c.nom ILIKE $1 OR c.code ILIKE $2 OR c.ville ILIKE $3)';
    }

    const countRes = await query<{ total: string }>(`SELECT COUNT(*) as total FROM clients c ${where}`, params);
    const total = parseInt(countRes.rows[0].total);

    const pIdx = params.length + 1;
    const { rows } = await query(
      `SELECT * FROM clients c ${where} ORDER BY c.${sort} ${order} LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({ data: rows, pagination: { total, limit, offset, has_more: (offset || 0) + rows.length < total } });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get clients'));
  }
});

// ─── POST /api/clients ─────────────────────────────────────────

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));
  }

  const { nom, matricule_fiscal, telephone, email, adresse, ville, notes } = parsed.data;

  try {
    const code = await nextCode('CLT');
    const { rows } = await query(
      `INSERT INTO clients (code, nom, matricule_fiscal, telephone, email, adresse, ville, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [code, nom, matricule_fiscal || null, telephone || null, email || null, adresse || null, ville || null, notes || null]
    );

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'CREATE',
      entity_type: 'clients', entity_id: rows[0].id, entity_numero: code,
      detail: `Client created: ${nom}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create client'));
  }
});

// ─── PUT /api/clients/:id ──────────────────────────────────────

router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = updateClientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data'));
  }

  const u = parsed.data;
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  const setIf = (key: string, val: any) => {
    if (val !== undefined) { fields.push(`${key} = $${idx++}`); values.push(val); }
  };
  setIf('nom', u.nom); setIf('matricule_fiscal', u.matricule_fiscal);
  setIf('telephone', u.telephone); setIf('email', u.email);
  setIf('adresse', u.adresse); setIf('ville', u.ville); setIf('notes', u.notes);

  if (fields.length === 0) return res.status(400).json(apiError('VALIDATION_ERROR', 'No fields to update'));
  values.push(req.params.id);

  try {
    const { rows } = await query(`UPDATE clients SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'Client not found'));

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'UPDATE',
      entity_type: 'clients', entity_id: rows[0].id, entity_numero: rows[0].code,
      detail: `Client updated: ${rows[0].nom}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update client'));
  }
});

// ─── DELETE /api/clients/:id ───────────────────────────────────

router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query('UPDATE clients SET actif = false WHERE id = $1 RETURNING code, nom', [req.params.id]);
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'Client not found'));

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'DEACTIVATE',
      entity_type: 'clients', entity_id: parseInt(req.params.id), entity_numero: rows[0].code,
      detail: `Client deactivated: ${rows[0].nom}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.json({ message: 'Client deactivated' });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to delete client'));
  }
});

export { router as clientsRouter };

