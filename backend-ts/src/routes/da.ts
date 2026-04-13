import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query, transaction } from '../db/pool.js';
import { nextCode, apiError } from '../utils/helpers.js';

const router = Router();

const createDASchema = z.object({
  description: z.string().min(1),
  materiau_id: z.number().int().nullable().optional(),
  of_id: z.number().int().nullable().optional(),
  objet: z.string().nullable().optional(),
  quantite: z.coerce.number().default(1),
  unite: z.string().default('pcs'),
  urgence: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
  demandeur_id: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ─── GET /api/achats/da ────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT da.*, m.nom as materiau_nom, m.code as materiau_code,
              of.numero as of_numero, p.nom as produit_nom,
              d.prenom as demandeur_prenom, d.nom as demandeur_nom,
              v.nom as valideur_nom
       FROM demandes_achat da
       LEFT JOIN materiaux m ON m.id = da.materiau_id
       LEFT JOIN ordres_fabrication of ON of.id = da.of_id
       LEFT JOIN produits p ON p.id = of.produit_id
       LEFT JOIN operateurs d ON d.id = da.demandeur_id
       LEFT JOIN users v ON v.id = da.valideur_id
       ORDER BY da.created_at DESC LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    console.error('Get DAs error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get DAs'));
  }
});

// ─── POST /api/achats/da ───────────────────────────────────────

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = createDASchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));

  const data = parsed.data;

  try {
    const numero = await nextCode('DA');
    const { rows } = await query(
      `INSERT INTO demandes_achat (da_numero, description, materiau_id, of_id, objet, quantite, unite, urgence, demandeur_id, statut, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10)
       RETURNING *`,
      [numero, data.description, data.materiau_id || null, data.of_id || null, data.objet || null, data.quantite, data.unite, data.urgence, data.demandeur_id || null, data.notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create DA error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create DA'));
  }
});

// ─── PUT /api/achats/da/:id ────────────────────────────────────

router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { statut } = req.body;
  if (!['PENDING', 'APPROVED', 'REJECTED', 'ORDERED', 'RECEIVED', 'CANCELLED'].includes(statut)) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid statut'));
  }

  try {
    const { rows } = await query(
      `UPDATE demandes_achat SET statut = $1, valideur_id = $2 WHERE id = $3 RETURNING *`,
      [statut, req.user!.userId, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'DA not found'));
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update DA'));
  }
});

// ─── DELETE /api/achats/da/:id ─────────────────────────────────

router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    await query("UPDATE demandes_achat SET statut = 'CANCELLED' WHERE id = $1", [req.params.id]);
    res.json({ message: 'DA cancelled' });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to delete DA'));
  }
});

export { router as daRouter };
