import { Router, Response } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { apiError } from '../utils/helpers.js';

const router = Router();

// ─── GET /api/dashboard ────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await query(
      `SELECT
        COUNT(*) FILTER (WHERE statut = 'IN_PROGRESS') as ordres_actifs,
        COUNT(*) FILTER (WHERE priorite = 'URGENT' AND statut != 'COMPLETED' AND statut != 'CANCELLED') as urgents,
        CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE statut = 'COMPLETED')::numeric / COUNT(*)::numeric * 100, 1) ELSE 0 END as taux_completion,
        (SELECT COUNT(*) FROM materiaux WHERE actif = true AND stock_actuel < stock_minimum) as alertes_stock,
        COUNT(*) FILTER (WHERE date_echeance < CURRENT_DATE AND statut NOT IN ('COMPLETED', 'CANCELLED')) as en_retard
       FROM ordres_fabrication WHERE actif != false`
    );

    // Monthly chart data (last 8 months)
    const monthly = await query(
      `SELECT TO_CHAR(date_trunc('month', d), 'Mon YY') as mois_label,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE of.statut = 'COMPLETED') as completes
       FROM generate_series(CURRENT_DATE - INTERVAL '8 months', CURRENT_DATE, INTERVAL '1 month') d
       LEFT JOIN ordres_fabrication of ON of.created_at >= d AND of.created_at < d + INTERVAL '1 month'
       GROUP BY d ORDER BY d`
    );

    res.json({
      ...stats.rows[0],
      graphique: monthly.rows.map((r: any) => ({
        mois_label: r.mois_label,
        total: parseInt(r.total),
        completes: parseInt(r.completes),
      })),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get dashboard'));
  }
});

// ─── GET /api/dashboard/operator/:operateur_id ──────────────────

router.get('/operator/:operateur_id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT
        COUNT(*) FILTER (WHERE of.statut = 'IN_PROGRESS') as mes_ofs_actifs,
        COUNT(*) FILTER (WHERE of.statut = 'COMPLETED') as ofs_termines,
        CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE of.statut = 'COMPLETED')::numeric / COUNT(*)::numeric * 100, 1) ELSE 0 END as performance
       FROM ordres_fabrication of
       JOIN of_operations op ON op.of_id = of.id
       JOIN op_operateurs oo ON oo.operation_id = op.id
       WHERE oo.operateur_id = $1`,
      [req.params.operateur_id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get operator dashboard'));
  }
});

export { router as dashboardRouter };

