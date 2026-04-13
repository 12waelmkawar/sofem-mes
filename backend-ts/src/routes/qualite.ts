import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { nextCode, apiError } from '../utils/helpers.js';

const router = Router();

const createCQSchema = z.object({
  of_id: z.number().int().positive(),
  type_controle: z.enum(['FINAL', 'INTERMEDIAIRE', 'RECEPTION']).default('FINAL'),
  operateur_id: z.number().int().nullable().optional(),
  date_controle: z.string().min(1),
  quantite_controlee: z.coerce.number().positive(),
  quantite_conforme: z.coerce.number().default(0),
  quantite_rebut: z.coerce.number().default(0),
  notes: z.string().nullable().optional(),
});

const createNCSchema = z.object({
  of_id: z.number().int().nullable().optional(),
  cq_id: z.number().int().nullable().optional(),
  type_defaut: z.string().min(1),
  description: z.string().nullable().optional(),
  gravite: z.enum(['MINEURE', 'MAJEURE', 'CRITIQUE']).default('MINEURE'),
  action_corrective: z.string().nullable().optional(),
  responsable_id: z.number().int().nullable().optional(),
});

// ─── GET /api/qualite/controles ────────────────────────────────

router.get('/controles', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT cq.*, of.numero as of_numero, p.nom as produit_nom,
              o.prenom as operateur_prenom, o.nom as operateur_nom
       FROM controle_qualite cq
       LEFT JOIN ordres_fabrication of ON of.id = cq.of_id
       LEFT JOIN produits p ON p.id = of.produit_id
       LEFT JOIN operateurs o ON o.id = cq.operateur_id
       ORDER BY cq.created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get controles'));
  }
});

// ─── POST /api/qualite/controles ────────────────────────────────

router.post('/controles', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = createCQSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));

  const data = parsed.data;
  // Auto-derive status
  let statut = 'EN_ATTENTE';
  if (data.quantite_rebut > 0 || data.quantite_conforme < data.quantite_controlee) {
    statut = 'NON_CONFORME';
  } else if (data.quantite_conforme === data.quantite_controlee && data.quantite_controlee > 0) {
    statut = 'CONFORME';
  }

  try {
    const numero = await nextCode('CQ');
    const { rows } = await query(
      `INSERT INTO controle_qualite (cq_numero, of_id, type_controle, operateur_id, date_controle, statut, quantite_controlee, quantite_conforme, quantite_rebut, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [numero, data.of_id, data.type_controle, data.operateur_id || null, data.date_controle, statut, data.quantite_controlee, data.quantite_conforme, data.quantite_rebut, data.notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create controle'));
  }
});

// ─── PUT /api/qualite/controles/:id ─────────────────────────────

router.put('/controles/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { statut } = req.body;
  if (!['EN_ATTENTE', 'CONFORME', 'NON_CONFORME', 'EN_COURS'].includes(statut)) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid statut'));
  }
  try {
    const { rows } = await query('UPDATE controle_qualite SET statut = $1 WHERE id = $2 RETURNING *', [statut, req.params.id]);
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'Not found'));
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update controle'));
  }
});

// ─── GET /api/qualite/nc ────────────────────────────────────────

router.get('/nc', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT nc.*, of.numero as of_numero, p.nom as produit_nom,
              resp.prenom as resp_prenom, resp.nom as resp_nom,
              cq.cq_numero
       FROM non_conformites nc
       LEFT JOIN ordres_fabrication of ON of.id = nc.of_id
       LEFT JOIN produits p ON p.id = of.produit_id
       LEFT JOIN controle_qualite cq ON cq.id = nc.cq_id
       LEFT JOIN operateurs resp ON resp.id = nc.responsable_id
       ORDER BY nc.created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get NCs'));
  }
});

// ─── POST /api/qualite/nc ──────────────────────────────────────

router.post('/nc', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = createNCSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));

  const data = parsed.data;

  try {
    const numero = await nextCode('NC');
    const { rows } = await query(
      `INSERT INTO non_conformites (nc_numero, cq_id, of_id, type_defaut, description, gravite, action_corrective, responsable_id, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OUVERTE') RETURNING *`,
      [numero, data.cq_id || null, data.of_id || null, data.type_defaut, data.description || null, data.gravite, data.action_corrective || null, data.responsable_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create NC'));
  }
});

// ─── PUT /api/qualite/nc/:id ───────────────────────────────────

router.put('/nc/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { statut } = req.body;
  if (!['OUVERTE', 'EN_COURS', 'CLOTUREE'].includes(statut)) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid statut'));
  }
  try {
    const updates: any[] = ['statut', statut];
    if (statut === 'CLOTUREE') updates.push('date_cloture', new Date().toISOString().split('T')[0]);
    const { rows } = await query(
      `UPDATE non_conformites SET statut = $1, date_cloture = $2 WHERE id = $3 RETURNING *`,
      [statut, statut === 'CLOTUREE' ? new Date().toISOString().split('T')[0] : null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'Not found'));
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update NC'));
  }
});

export { router as qualiteRouter };
