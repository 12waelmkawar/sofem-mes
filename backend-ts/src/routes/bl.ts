import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { nextCode, parsePagination, logActivity, apiError } from '../utils/helpers.js';

const router = Router();

const deliverSchema = z.object({
  destinataire: z.string().min(1),
  adresse: z.string().default('Route Sidi Salem 2.5KM, Sfax'),
  date_livraison: z.string().min(1),
  notes: z.string().nullable().optional(),
});

// ─── GET /api/bl ────────────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT bl.*, of.numero as of_numero, p.nom as produit_nom, of.quantite,
              c.nom as destinataire_nom
       FROM bons_livraison bl
       JOIN ordres_fabrication of ON of.id = bl.of_id
       JOIN produits p ON p.id = of.produit_id
       LEFT JOIN clients c ON c.id = of.client_id
       ORDER BY bl.created_at DESC
       LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get BLs'));
  }
});

// ─── PUT /api/bl/:id/livrer ─────────────────────────────────────

router.put('/:id/livrer', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = deliverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data'));

  try {
    // Check OF is COMPLETED
    const ofCheck = await query("SELECT statut FROM ordres_fabrication WHERE id = (SELECT of_id FROM bons_livraison WHERE id = $1)", [req.params.id]);
    if (ofCheck.rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'BL not found'));
    if (ofCheck.rows[0].statut !== 'COMPLETED') {
      return res.status(400).json(apiError('VALIDATION_ERROR', `OF not completed (current: ${ofCheck.rows[0].statut})`));
    }

    const { rows } = await query(
      `UPDATE bons_livraison SET statut = 'LIVRE', date_livraison_reelle = NOW(), destinataire = $1, adresse = $2, date_livraison = $3, notes = $4
       WHERE id = $5 RETURNING *`,
      [parsed.data.destinataire, parsed.data.adresse, parsed.data.date_livraison, parsed.data.notes || null, req.params.id]
    );

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'CONFIRM',
      entity_type: 'bons_livraison', entity_id: rows[0].id, entity_numero: rows[0].numero,
      detail: `BL delivered: ${rows[0].numero}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.json(rows[0]);
  } catch (err: any) {
    if (err.message?.includes('not completed')) {
      return res.status(400).json(apiError('VALIDATION_ERROR', err.message));
    }
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to deliver BL'));
  }
});

export { router as blRouter };
