import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { nextCode, parsePagination, logActivity, apiError } from '../utils/helpers.js';

const router = Router();

const createMachineSchema = z.object({
  nom: z.string().min(1),
  type: z.string().nullable().optional(),
  atelier: z.string().default('Atelier A'),
  marque: z.string().nullable().optional(),
  modele: z.string().nullable().optional(),
  numero_serie: z.string().nullable().optional(),
  statut: z.enum(['OPERATIONNELLE', 'EN_MAINTENANCE', 'EN_PANNE', 'ARRETEE']).default('OPERATIONNELLE'),
  notes: z.string().nullable().optional(),
});

const updateMachineSchema = createMachineSchema.partial();

// ─── GET /api/machines ─────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`SELECT * FROM machines WHERE actif = true ORDER BY code`);
    res.json(rows);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get machines'));
  }
});

// ─── GET /api/machines/stats/overview ──────────────────────────

router.get('/stats/overview', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE statut = 'OPERATIONNELLE') as operationnelles,
        COUNT(*) FILTER (WHERE statut = 'EN_MAINTENANCE') as en_maintenance,
        COUNT(*) FILTER (WHERE statut = 'EN_PANNE') as en_panne,
        COUNT(*) FILTER (WHERE statut = 'ARRETEE') as arretees
       FROM machines WHERE actif = true`
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get machine stats'));
  }
});

// ─── POST /api/machines ────────────────────────────────────────

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = createMachineSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));
  }

  const { nom, type, atelier, marque, modele, numero_serie, statut, notes } = parsed.data;

  try {
    const code = await nextCode('MCH');
    const { rows } = await query(
      `INSERT INTO machines (code, nom, type, atelier, marque, modele, numero_serie, statut, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [code, nom, type || null, atelier, marque || null, modele || null, numero_serie || null, statut, notes || null]
    );

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'CREATE',
      entity_type: 'machines', entity_id: rows[0].id, entity_numero: code,
      detail: `Machine created: ${nom}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create machine'));
  }
});

// ─── PUT /api/machines/:id ─────────────────────────────────────

router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = updateMachineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data'));

  const u = parsed.data;
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  const setIf = (k: string, v: any) => { if (v !== undefined) { fields.push(`${k} = $${idx++}`); values.push(v); } };

  setIf('nom', u.nom); setIf('type', u.type); setIf('atelier', u.atelier);
  setIf('marque', u.marque); setIf('modele', u.modele); setIf('numero_serie', u.numero_serie);
  setIf('statut', u.statut); setIf('notes', u.notes);

  if (fields.length === 0) return res.status(400).json(apiError('VALIDATION_ERROR', 'No fields to update'));
  values.push(req.params.id);

  try {
    const { rows } = await query(`UPDATE machines SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'Machine not found'));

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'UPDATE',
      entity_type: 'machines', entity_id: rows[0].id, entity_numero: rows[0].code,
      detail: `Machine updated: ${rows[0].nom}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update machine'));
  }
});

// ─── DELETE /api/machines/:id ──────────────────────────────────

router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query('UPDATE machines SET actif = false WHERE id = $1 RETURNING code, nom', [req.params.id]);
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'Machine not found'));

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'DEACTIVATE',
      entity_type: 'machines', entity_id: parseInt(req.params.id), entity_numero: rows[0].code,
      detail: `Machine deactivated: ${rows[0].nom}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.json({ message: 'Machine deactivated' });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to delete machine'));
  }
});

export { router as machinesRouter };
