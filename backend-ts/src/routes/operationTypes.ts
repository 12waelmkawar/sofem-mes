import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { apiError } from '../utils/helpers.js';

const router = Router();

const createOpTypeSchema = z.object({
  nom: z.string().min(1),
  description: z.string().nullable().optional(),
  ordre: z.coerce.number().int().optional(),
});

const updateOpTypeSchema = createOpTypeSchema.partial();

// ─── GET /api/operation-types ──────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`SELECT * FROM operation_types WHERE actif = true ORDER BY ordre`);
    res.json(rows);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get operation types'));
  }
});

// ─── GET /api/operation-types/all ──────────────────────────────

router.get('/all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`SELECT * FROM operation_types ORDER BY ordre`);
    res.json(rows);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get operation types'));
  }
});

// ─── POST /api/operation-types ─────────────────────────────────

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = createOpTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data'));

  const { nom, description, ordre } = parsed.data;

  try {
    // Check duplicate
    const existing = await query('SELECT id FROM operation_types WHERE nom = $1', [nom]);
    if (existing.rows.length > 0) {
      return res.status(400).json(apiError('CONFLICT', `Operation type "${nom}" already exists`));
    }

    // Get max ordre
    const maxOrdre = await query<{ max_ordre: string }>('SELECT COALESCE(MAX(ordre), 0) as max_ordre FROM operation_types');
    const newOrdre = ordre ?? parseInt(maxOrdre.rows[0].max_ordre) + 1;

    const { rows } = await query(
      `INSERT INTO operation_types (nom, description, ordre) VALUES ($1, $2, $3) RETURNING *`,
      [nom, description || null, newOrdre]
    );

    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(400).json(apiError('CONFLICT', 'Duplicate name'));
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create operation type'));
  }
});

// ─── PUT /api/operation-types/:id ──────────────────────────────

router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = updateOpTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data'));

  const u = parsed.data;
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  const setIf = (k: string, v: any) => { if (v !== undefined) { fields.push(`${k} = $${idx++}`); values.push(v); } };
  setIf('nom', u.nom); setIf('description', u.description); setIf('ordre', u.ordre);
  if (fields.length === 0) return res.status(400).json(apiError('VALIDATION_ERROR', 'No fields to update'));
  values.push(req.params.id);

  try {
    const { rows } = await query(`UPDATE operation_types SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'Not found'));
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update'));
  }
});

// ─── DELETE /api/operation-types/:id ───────────────────────────

router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    // Check if used in OFs
    const used = await query<{ count: string }>('SELECT COUNT(*) FROM of_operations WHERE operation_nom = (SELECT nom FROM operation_types WHERE id = $1)', [req.params.id]);
    const count = parseInt(used.rows[0].count);

    if (count > 0) {
      // Soft deactivate
      await query('UPDATE operation_types SET actif = false WHERE id = $1', [req.params.id]);
      return res.json({ message: `Operation type deactivated (used in ${count} OFs)` });
    }

    await query('DELETE FROM operation_types WHERE id = $1', [req.params.id]);
    res.json({ message: 'Operation type deleted' });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to delete'));
  }
});

export { router as operationTypesRouter };
