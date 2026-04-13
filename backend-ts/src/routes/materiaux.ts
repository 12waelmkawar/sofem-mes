import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query, transaction } from '../db/pool.js';
import { nextCode, parsePagination, logActivity, apiError } from '../utils/helpers.js';

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────

const createMateriauSchema = z.object({
  nom: z.string().min(1, 'Nom is required'),
  unite: z.string().min(1, 'Unite is required').default('pcs'),
  stock_actuel: z.coerce.number().default(0),
  stock_minimum: z.coerce.number().default(0),
  fournisseur: z.string().nullable().optional(),
  prix_unitaire: z.coerce.number().default(0),
});

const updateMateriauSchema = z.object({
  nom: z.string().min(1).optional(),
  unite: z.string().min(1).optional(),
  stock_minimum: z.coerce.number().optional(),
  fournisseur: z.string().nullable().optional(),
  prix_unitaire: z.coerce.number().optional(),
});

const mouvementSchema = z.object({
  materiau_id: z.number().int().positive(),
  type: z.enum(['ENTREE', 'SORTIE', 'ADJUST']),
  quantite: z.coerce.number().positive(),
  motif: z.string().optional(),
  of_id: z.number().int().nullable().optional(),
});

// ─── GET /api/materiaux ────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { limit, offset, sort, order, search } = parsePagination(req.query);

    let where = 'WHERE m.actif = true';
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      where += ' AND (m.nom ILIKE $1 OR m.code ILIKE $2)';
    }

    // Count total
    const countRes = await query<{ total: string }>(
      `SELECT COUNT(*) as total FROM materiaux m ${where}`,
      search ? params : []
    );
    const total = parseInt(countRes.rows[0].total);

    // Fetch with pagination
    const pIdx = params.length + 1;
    const { rows } = await query(
      `SELECT m.*, 
              CASE WHEN m.stock_minimum > 0 THEN ROUND(m.stock_actuel::numeric / m.stock_minimum::numeric * 100, 1) ELSE 100 END as pct_stock,
              CASE WHEN m.stock_actuel < m.stock_minimum THEN true ELSE false END as alerte
       FROM materiaux m ${where}
       ORDER BY m.${sort} ${order}
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: {
        total,
        limit,
        offset,
        has_more: (offset || 0) + rows.length < total,
      },
    });
  } catch (err) {
    console.error('Get materiaux error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get materials'));
  }
});

// ─── POST /api/materiaux ───────────────────────────────────────

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = createMateriauSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));
  }

  const { nom, unite, stock_actuel, stock_minimum, fournisseur, prix_unitaire } = parsed.data;

  try {
    const code = await nextCode('MAT');
    const { rows } = await query(
      `INSERT INTO materiaux (code, nom, unite, stock_actuel, stock_minimum, fournisseur, prix_unitaire)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [code, nom, unite, stock_actuel, stock_minimum, fournisseur || null, prix_unitaire]
    );

    await logActivity({
      user_id: req.user!.userId,
      user_nom: req.user!.nom,
      action: 'CREATE',
      entity_type: 'materiaux',
      entity_id: rows[0].id,
      entity_numero: code,
      detail: `Material created: ${nom}`,
      ip_address: req.ip || undefined,
      session_token: req.user!.sessionToken,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create materiau error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create material'));
  }
});

// ─── PUT /api/materiaux/:id ────────────────────────────────────

router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = updateMateriauSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data'));
  }

  const updates = parsed.data;
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.nom !== undefined) { fields.push(`nom = $${idx++}`); values.push(updates.nom); }
  if (updates.unite !== undefined) { fields.push(`unite = $${idx++}`); values.push(updates.unite); }
  if (updates.stock_minimum !== undefined) { fields.push(`stock_minimum = $${idx++}`); values.push(updates.stock_minimum); }
  if (updates.fournisseur !== undefined) { fields.push(`fournisseur = $${idx++}`); values.push(updates.fournisseur); }
  if (updates.prix_unitaire !== undefined) { fields.push(`prix_unitaire = $${idx++}`); values.push(updates.prix_unitaire); }

  if (fields.length === 0) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'No fields to update'));
  }

  values.push(req.params.id);

  try {
    const { rows } = await query(
      `UPDATE materiaux SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json(apiError('NOT_FOUND', 'Material not found'));
    }

    await logActivity({
      user_id: req.user!.userId,
      user_nom: req.user!.nom,
      action: 'UPDATE',
      entity_type: 'materiaux',
      entity_id: rows[0].id,
      entity_numero: rows[0].code,
      detail: `Material updated: ${rows[0].nom}`,
      ip_address: req.ip || undefined,
      session_token: req.user!.sessionToken,
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('Update materiau error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update material'));
  }
});

// ─── PUT /api/materiaux/:id/prix ───────────────────────────────

router.put('/:id/prix', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { prix_unitaire } = req.body;
  if (prix_unitaire === undefined || prix_unitaire < 0) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'prix_unitaire must be >= 0'));
  }

  try {
    const { rows } = await query(
      'UPDATE materiaux SET prix_unitaire = $1 WHERE id = $2 RETURNING *',
      [prix_unitaire, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json(apiError('NOT_FOUND', 'Material not found'));
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Update prix error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update price'));
  }
});

// ─── GET /api/materiaux/:id/prix-historique ────────────────────

router.get('/:id/prix-historique', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Price history from mouvement_stock where motif mentions price change
    const { rows } = await query(
      `SELECT m.created_at, m.quantite as new_price, m.motif
       FROM mouvements_stock m
       WHERE m.materiau_id = $1 AND m.type = 'ADJUST' AND m.motif ILIKE '%prix%'
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get price history'));
  }
});

// ─── DELETE /api/materiaux/:id ─────────────────────────────────

router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      'UPDATE materiaux SET actif = false WHERE id = $1 RETURNING code, nom',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json(apiError('NOT_FOUND', 'Material not found'));
    }

    await logActivity({
      user_id: req.user!.userId,
      user_nom: req.user!.nom,
      action: 'DEACTIVATE',
      entity_type: 'materiaux',
      entity_id: parseInt(req.params.id),
      entity_numero: rows[0].code,
      detail: `Material deactivated: ${rows[0].nom}`,
      ip_address: req.ip || undefined,
      session_token: req.user!.sessionToken,
    });

    res.json({ message: 'Material deactivated' });
  } catch (err) {
    console.error('Delete materiau error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to deactivate material'));
  }
});

// ─── POST /api/materiaux/mouvement ─────────────────────────────

router.post('/mouvement', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = mouvementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid movement data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));
  }

  const { materiau_id, type, quantite, motif, of_id } = parsed.data;

  try {
    const result = await transaction(async (q) => {
      // Lock the materiau row
      const matRes = await q('SELECT * FROM materiaux WHERE id = $1 FOR UPDATE', [materiau_id]);
      if (matRes.rows.length === 0) {
        throw new Error('Material not found');
      }

      const mat = matRes.rows[0];
      const stock_avant = parseFloat(mat.stock_actuel);
      let stock_apres: number;

      if (type === 'ENTREE') {
        stock_apres = stock_avant + quantite;
      } else if (type === 'SORTIE') {
        stock_apres = stock_avant - quantite;
        if (stock_apres < 0) {
          throw new Error('Stock would go negative');
        }
      } else {
        // ADJUST: set to exact value
        stock_apres = quantite;
      }

      // Update stock
      await q('UPDATE materiaux SET stock_actuel = $1 WHERE id = $2', [stock_apres, materiau_id]);

      // Record movement
      const movRes = await q(
        `INSERT INTO mouvements_stock (materiau_id, of_id, type, quantite, stock_avant, stock_apres, motif)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [materiau_id, of_id || null, type, quantite, stock_avant, stock_apres, motif || null]
      );

      return { ...movRes.rows[0], materiau_nom: mat.nom, stock_avant, stock_apres };
    });

    await logActivity({
      user_id: req.user!.userId,
      user_nom: req.user!.nom,
      action: 'CREATE',
      entity_type: 'mouvements_stock',
      detail: `${type}: ${result.materiau_nom} \${result.stock_avant} -> ${result.stock_apres}`,
      ip_address: req.ip || undefined,
      session_token: req.user!.sessionToken,
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error('Stock movement error:', err);
    if (err.message === 'Material not found') {
      return res.status(404).json(apiError('NOT_FOUND', 'Material not found'));
    }
    if (err.message === 'Stock would go negative') {
      return res.status(400).json(apiError('VALIDATION_ERROR', 'Stock would go negative'));
    }
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to record movement'));
  }
});

// ─── GET /api/materiaux/mouvements ─────────────────────────────

router.get('/mouvements', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const { rows } = await query(
      `SELECT ms.*, m.nom as materiau_nom, m.code as materiau_code, m.unite,
              of.numero as of_numero
       FROM mouvements_stock ms
       JOIN materiaux m ON m.id = ms.materiau_id
       LEFT JOIN ordres_fabrication of ON of.id = ms.of_id
       ORDER BY ms.created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json(rows);
  } catch (err) {
    console.error('Get mouvements error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get movements'));
  }
});

export { router as materiauxRouter };

