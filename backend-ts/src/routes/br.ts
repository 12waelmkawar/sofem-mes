import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query, transaction } from '../db/pool.js';
import { nextCode, apiError } from '../utils/helpers.js';

const router = Router();

// ─── GET /api/achats/br ────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT br.*, bc.bc_numero, bc.fournisseur, bc.statut as bc_statut
       FROM bons_reception br
       JOIN bons_commande bc ON bc.id = br.bc_id
       ORDER BY br.created_at DESC LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get BRs'));
  }
});

// ─── POST /api/achats/br ───────────────────────────────────────

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { bc_id, date_reception, notes } = req.body;
  if (!bc_id || !date_reception) return res.status(400).json(apiError('VALIDATION_ERROR', 'bc_id and date_reception required'));

  try {
    // Get BC lines
    const { rows: bcLines } = await query('SELECT * FROM bc_lignes WHERE bc_id = $1', [bc_id]);
    const { rows: bc } = await query('SELECT * FROM bons_commande WHERE id = $1', [bc_id]);
    if (bc.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'BC not found'));

    const totalQty = bcLines.reduce((s: number, l: any) => s + l.quantite, 0);

    const numero = await nextCode('BR');
    const { rows } = await query(
      `INSERT INTO bons_reception (br_numero, bc_id, statut, date_reception, notes, quantite_commandee, unite, montant_total, fournisseur)
       VALUES ($1, $2, 'EN_ATTENTE', $3, $4, $5, $6, 0, $7) RETURNING *`,
      [numero, bc_id, date_reception, notes || null, totalQty, bcLines[0]?.unite || 'pcs', bc[0].fournisseur]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create BR'));
  }
});

// ─── PUT /api/achats/br/:id/confirmer ──────────────────────────

router.put('/:id/confirmer', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { quantite_recue, prix_unitaire } = req.body;
  if (!quantite_recue) return res.status(400).json(apiError('VALIDATION_ERROR', 'quantite_recue required'));

  try {
    const result = await transaction(async (q) => {
      const brRes = await q('SELECT * FROM bons_reception WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (brRes.rows.length === 0) throw new Error('BR not found');
      const br = brRes.rows[0];

      // Update stock for each BC line material
      const bcLinesRes = await q('SELECT * FROM bc_lignes WHERE bc_id = $1', [br.bc_id]);
      for (const line of bcLinesRes.rows) {
        if (!line.materiau_id) continue;
        const matRes = await q('SELECT * FROM materiaux WHERE id = $1 FOR UPDATE', [line.materiau_id]);
        if (matRes.rows.length === 0) continue;
        const stock_apres = matRes.rows[0].stock_actuel + quantite_recue;
        await q('UPDATE materiaux SET stock_actuel = $1 WHERE id = $2', [stock_apres, line.materiau_id]);
        await q(
          `INSERT INTO mouvements_stock (materiau_id, type, quantite, stock_avant, stock_apres, motif)
           VALUES ($1, 'ENTREE', $2, $3, $4, $5)`,
          [line.materiau_id, quantite_recue, matRes.rows[0].stock_actuel, stock_apres, `BR: ${br.br_numero}`]
        );
      }

      // Update BR
      const statut = quantite_recue >= br.quantite_commandee ? 'COMPLET' : 'PARTIEL';
      await q('UPDATE bons_reception SET statut = $1, quantite_recue = $2, montant_total = $3 WHERE id = $4',
        [statut, quantite_recue, quantite_recue * (prix_unitaire || 0), req.params.id]);

      // Update BC statut
      await q("UPDATE bons_commande SET statut = CASE WHEN $1 >= quantite_commandee THEN 'RECU' ELSE 'RECU_PARTIEL' END WHERE id = $2", [quantite_recue, br.bc_id]);

      // Update DA if linked
      await q("UPDATE demandes_achat SET statut = 'RECEIVED' WHERE id = (SELECT da_id FROM bons_commande WHERE id = $1) AND statut != 'CANCELLED'", [br.bc_id]);

      return { statut, quantite_recue };
    });

    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('not found')) return res.status(404).json(apiError('NOT_FOUND', err.message));
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to confirm reception'));
  }
});

export { router as brRouter };
