import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { nextCode, apiError } from '../utils/helpers.js';

const router = Router();

// ─── GET /api/achats/fa ────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT fa.*, bc.bc_numero, bc.fournisseur
       FROM factures_achat fa
       LEFT JOIN bons_commande bc ON bc.id = fa.bc_id
       ORDER BY fa.created_at DESC LIMIT 500`
    );
    res.json(rows);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get FAs')); }
});

// ─── POST /api/achats/fa ───────────────────────────────────────

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { bc_id, fournisseur, date_facture, notes } = req.body;
  if (!fournisseur || !date_facture) return res.status(400).json(apiError('VALIDATION_ERROR', 'Required fields missing'));
  try {
    const numero = await nextCode('FA');
    const bc = bc_id ? await query('SELECT montant_ht FROM bons_commande WHERE id = $1', [bc_id]).then(r => r.rows[0]) : null;
    const { rows } = await query(
      `INSERT INTO factures_achat (fa_numero, bc_id, fournisseur, date_facture, montant_ht, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [numero, bc_id || null, fournisseur, date_facture, bc?.montant_ht || 0, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create FA')); }
});

export { router as faRouter };

// ─── Maintenance ───────────────────────────────────────────────

const maintRouter = Router();
const createMaintSchema = z.object({ titre: z.string().min(1), machine_id: z.number().int(), type_maintenance: z.enum(['PREVENTIVE', 'CORRECTIVE', 'URGENCE']).default('CORRECTIVE'), priorite: z.enum(['BASSE', 'NORMAL', 'HAUTE', 'URGENTE']).default('NORMAL'), technicien_id: z.number().int().nullable().optional(), date_planifiee: z.string().nullable().optional(), description: z.string().nullable().optional(), notes: z.string().nullable().optional() });

maintRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT mo.*, m.nom as machine_nom, t.prenom as technicien_prenom, t.nom as technicien_nom
       FROM maintenance_orders mo
       JOIN machines m ON m.id = mo.machine_id
       LEFT JOIN operateurs t ON t.id = mo.technicien_id
       ORDER BY mo.created_at DESC LIMIT 500`
    );
    res.json(rows);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get maintenance orders')); }
});

maintRouter.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = createMaintSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data'));
  const d = parsed.data;
  try {
    const numero = await nextCode('OM');
    const { rows } = await query(
      `INSERT INTO maintenance_orders (om_numero, titre, machine_id, type_maintenance, priorite, technicien_id, date_planifiee, description, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [numero, d.titre, d.machine_id, d.type_maintenance, d.priorite, d.technicien_id || null, d.date_planifiee || null, d.description || null, d.notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create maintenance order')); }
});

maintRouter.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { statut } = req.body;
  if (!['PLANIFIE', 'EN_COURS', 'TERMINE', 'ANNULE'].includes(statut)) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid statut'));
  try {
    const { rows } = await query('UPDATE maintenance_orders SET statut = $1 WHERE id = $2 RETURNING *', [statut, req.params.id]);
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'Not found'));
    res.json(rows[0]);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update')); }
});

export { maintRouter };

// ─── Reports & Activity ────────────────────────────────────────

const reportsRouter = Router();

reportsRouter.get('/production-mensuelle', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT TO_CHAR(date_trunc('month', d), 'Mon YY') as mois_label, COUNT(*) FILTER (WHERE of.id IS NOT NULL) as total
       FROM generate_series(CURRENT_DATE - INTERVAL '12 months', CURRENT_DATE, INTERVAL '1 month') d
       LEFT JOIN ordres_fabrication of ON of.created_at >= d AND of.created_at < d + INTERVAL '1 month'
       GROUP BY d ORDER BY d`
    );
    res.json(rows.map((r: any) => ({ ...r, total: parseInt(r.total) })));
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed')); }
});

reportsRouter.get('/stock-alertes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT id, nom, stock_actuel, stock_minimum, unite,
              CASE WHEN stock_minimum > 0 THEN ROUND(stock_actuel::numeric / stock_minimum::numeric * 100, 1) ELSE 100 END as pct_stock
       FROM materiaux WHERE actif = true AND stock_actuel < stock_minimum ORDER BY pct_stock ASC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed')); }
});

const activityRouter = Router();
activityRouter.get('/activity', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query('SELECT * FROM activity_log_v2 ORDER BY created_at DESC LIMIT 200');
    res.json(rows);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed')); }
});

export { reportsRouter, activityRouter };
