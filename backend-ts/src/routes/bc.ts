import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { nextCode, apiError } from '../utils/helpers.js';

const router = Router();

const bcLineSchema = z.object({ materiau_id: z.number().int().positive(), description: z.string().nullable().optional(), quantite: z.coerce.number().positive(), unite: z.string().default('pcs') });
const createBCSchema = z.object({ fournisseur: z.string().min(1), da_id: z.number().int().nullable().optional(), statut: z.string().default('DRAFT'), lignes: z.array(bcLineSchema).default([]), notes: z.string().nullable().optional() });

// ─── GET /api/achats/bc ────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT bc.*, da.da_numero, m.nom as materiau_nom
       FROM bons_commande bc
       LEFT JOIN demandes_achat da ON da.id = bc.da_id
       LEFT JOIN materiaux m ON m.id = da.materiau_id
       ORDER BY bc.created_at DESC LIMIT 500`
    );
    // Get line items
    const bcs = await Promise.all(rows.map(async (bc: any) => {
      const { rows: lignes } = await query(
        `SELECT bl.*, m.nom as materiau_nom, m.code as materiau_code
         FROM bc_lignes bl LEFT JOIN materiaux m ON m.id = bl.materiau_id WHERE bl.bc_id = $1`,
        [bc.id]
      );
      return { ...bc, lignes };
    }));
    res.json(bcs);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get BCs'));
  }
});

// ─── POST /api/achats/bc ───────────────────────────────────────

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = createBCSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));

  const { fournisseur, da_id, statut, lignes, notes } = parsed.data;

  try {
    const numero = await nextCode('BC');
    const montantHT = lignes.reduce((sum, l) => sum + (l.quantite * 10), 0); // simplified
    const { rows } = await query(
      `INSERT INTO bons_commande (bc_numero, fournisseur, da_id, statut, notes, montant_ht, montant_ttc)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [numero, fournisseur, da_id || null, statut, notes || null, montantHT, montantHT * 1.19]
    );
    const bcId = rows[0].id;
    for (const l of lignes) {
      await query(
        `INSERT INTO bc_lignes (bc_id, materiau_id, description, quantite, unite) VALUES ($1, $2, $3, $4, $5)`,
        [bcId, l.materiau_id || null, l.description || null, l.quantite, l.unite]
      );
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create BC'));
  }
});

// ─── PUT /api/achats/bc/:id ────────────────────────────────────

router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { statut } = req.body;
  if (!statut) return res.status(400).json(apiError('VALIDATION_ERROR', 'Statut required'));
  try {
    const { rows } = await query('UPDATE bons_commande SET statut = $1 WHERE id = $2 RETURNING *', [statut, req.params.id]);
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'BC not found'));
    res.json(rows[0]);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update BC')); }
});

export { router as bcRouter };
