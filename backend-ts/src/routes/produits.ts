import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query, transaction } from '../db/pool.js';
import { nextCode, parsePagination, logActivity, apiError } from '../utils/helpers.js';

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────

const createProduitSchema = z.object({
  nom: z.string().min(1, 'Nom is required'),
  description: z.string().optional(),
  unite: z.string().default('pcs'),
  prix_vente_ht: z.coerce.number().default(0),
});

const updateProduitSchema = z.object({
  nom: z.string().min(1).optional(),
  description: z.string().optional(),
  unite: z.string().min(1).optional(),
  prix_vente_ht: z.coerce.number().optional(),
});

const bomLineSchema = z.object({
  materiau_id: z.number().int().positive(),
  quantite_par_unite: z.coerce.number().positive(),
});

// ─── GET /api/produits ─────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { limit, offset, sort, order, search } = parsePagination(req.query);

    let where = 'WHERE p.actif = true';
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      where += ' AND (p.nom ILIKE $1 OR p.code ILIKE $1)';
    }

    const countRes = await query<{ total: string }>(
      `SELECT COUNT(*) as total FROM produits p ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].total);

    const pIdx = params.length + 1;
    const { rows } = await query(
      `SELECT p.*,
              COALESCE(json_agg(json_build_object(
                'materiau_id', b.materiau_id,
                'materiau_nom', m.nom,
                'materiau_code', m.code,
                'unite', m.unite,
                'stock_actuel', m.stock_actuel,
                'quantite_par_unite', b.quantite_par_unite
              )) FILTER (WHERE b.materiau_id IS NOT NULL), '[]') as bom
       FROM produits p
       LEFT JOIN bom b ON b.produit_id = p.id
       LEFT JOIN materiaux m ON m.id = b.materiau_id
       ${where}
       GROUP BY p.id
       ORDER BY p.${sort} ${order}
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: { total, limit, offset, has_more: (offset || 0) + rows.length < total },
    });
  } catch (err) {
    console.error('Get produits error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get products'));
  }
});

// ─── POST /api/produits ────────────────────────────────────────

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = createProduitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));
  }

  const { nom, description, unite, prix_vente_ht } = parsed.data;

  try {
    const code = await nextCode('SOFEM');
    const { rows } = await query(
      `INSERT INTO produits (code, nom, description, unite, prix_vente_ht)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [code, nom, description || null, unite, prix_vente_ht]
    );

    await logActivity({
      user_id: req.user!.userId,
      user_nom: req.user!.nom,
      action: 'CREATE',
      entity_type: 'produits',
      entity_id: rows[0].id,
      entity_numero: code,
      detail: `Product created: ${nom}`,
      ip_address: req.ip || undefined,
      session_token: req.user!.sessionToken,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create produit error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create product'));
  }
});

// ─── PUT /api/produits/:id ─────────────────────────────────────

router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = updateProduitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data'));
  }

  const updates = parsed.data;
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.nom !== undefined) { fields.push(`nom = $${idx++}`); values.push(updates.nom); }
  if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
  if (updates.unite !== undefined) { fields.push(`unite = $${idx++}`); values.push(updates.unite); }
  if (updates.prix_vente_ht !== undefined) { fields.push(`prix_vente_ht = $${idx++}`); values.push(updates.prix_vente_ht); }

  if (fields.length === 0) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'No fields to update'));
  }

  values.push(req.params.id);

  try {
    const { rows } = await query(
      `UPDATE produits SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json(apiError('NOT_FOUND', 'Product not found'));
    }

    await logActivity({
      user_id: req.user!.userId,
      user_nom: req.user!.nom,
      action: 'UPDATE',
      entity_type: 'produits',
      entity_id: rows[0].id,
      entity_numero: rows[0].code,
      detail: `Product updated: ${rows[0].nom}`,
      ip_address: req.ip || undefined,
      session_token: req.user!.sessionToken,
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('Update produit error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update product'));
  }
});

// ─── DELETE /api/produits/:id ──────────────────────────────────

router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      'UPDATE produits SET actif = false WHERE id = $1 RETURNING code, nom',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json(apiError('NOT_FOUND', 'Product not found'));
    }

    await logActivity({
      user_id: req.user!.userId,
      user_nom: req.user!.nom,
      action: 'DEACTIVATE',
      entity_type: 'produits',
      entity_id: parseInt(req.params.id),
      entity_numero: rows[0].code,
      detail: `Product deactivated: ${rows[0].nom}`,
      ip_address: req.ip || undefined,
      session_token: req.user!.sessionToken,
    });

    res.json({ message: 'Product deactivated' });
  } catch (err) {
    console.error('Delete produit error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to delete product'));
  }
});

// ─── PUT /api/produits/:id/prix ────────────────────────────────

router.put('/:id/prix', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { prix_vente_ht } = req.body;
  if (prix_vente_ht === undefined || prix_vente_ht < 0) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'prix_vente_ht must be >= 0'));
  }

  try {
    const { rows } = await query(
      'UPDATE produits SET prix_vente_ht = $1 WHERE id = $2 RETURNING *',
      [prix_vente_ht, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json(apiError('NOT_FOUND', 'Product not found'));
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update price'));
  }
});

// ─── GET /api/produits/:id/bom ─────────────────────────────────

router.get('/:id/bom', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT b.*, m.nom as materiau_nom, m.code as materiau_code, m.unite, m.stock_actuel
       FROM bom b
       JOIN materiaux m ON m.id = b.materiau_id
       WHERE b.produit_id = $1
       ORDER BY m.nom`,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get BOM'));
  }
});

// ─── POST /api/produits/:id/bom ────────────────────────────────

router.post('/:id/bom', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = bomLineSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid BOM line'));
  }

  const { materiau_id, quantite_par_unite } = parsed.data;

  try {
    const { rows } = await query(
      `INSERT INTO bom (produit_id, materiau_id, quantite_par_unite)
       VALUES ($1, $2, $3)
       ON CONFLICT (produit_id, materiau_id) DO UPDATE SET quantite_par_unite = EXCLUDED.quantite_par_unite
       RETURNING *`,
      [req.params.id, materiau_id, quantite_par_unite]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Add BOM line error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to add BOM line'));
  }
});

// ─── PUT /api/produits/:id/bom ─────────────────────────────────

router.put('/:id/bom', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = z.array(bomLineSchema).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid BOM data'));
  }

  const bomLines = parsed.data.filter(l => l.quantite_par_unite > 0);

  try {
    await transaction(async (q) => {
      // Delete existing BOM
      await q('DELETE FROM bom WHERE produit_id = $1', [req.params.id]);

      // Insert new BOM lines
      for (const line of bomLines) {
        await q(
          `INSERT INTO bom (produit_id, materiau_id, quantite_par_unite)
           VALUES ($1, $2, $3)`,
          [req.params.id, line.materiau_id, line.quantite_par_unite]
        );
      }
    });

    await logActivity({
      user_id: req.user!.userId,
      user_nom: req.user!.nom,
      action: 'UPDATE',
      entity_type: 'produits',
      entity_id: parseInt(req.params.id),
      detail: `BOM replaced with ${bomLines.length} lines`,
      ip_address: req.ip || undefined,
      session_token: req.user!.sessionToken,
    });

    res.json({ message: 'BOM updated', count: bomLines.length });
  } catch (err) {
    console.error('Replace BOM error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update BOM'));
  }
});

// ─── DELETE /api/produits/:id/bom/:materiau_id ─────────────────

router.delete('/:id/bom/:materiau_id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM bom WHERE produit_id = $1 AND materiau_id = $2', [req.params.id, req.params.materiau_id]);
    res.json({ message: 'BOM line removed' });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to remove BOM line'));
  }
});

export { router as produitsRouter };

