import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query, transaction } from '../db/pool.js';
import { nextCode, parsePagination, logActivity, apiError } from '../utils/helpers.js';

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────

const operationSchema = z.object({
  operation_nom: z.string().min(1),
  machine_id: z.number().int().nullable().optional(),
  ordre: z.coerce.number().int().default(0),
  duree_prevue: z.coerce.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const bomOverrideSchema = z.object({
  materiau_id: z.number().int().positive(),
  quantite_requise: z.coerce.number().positive(),
});

const createOFSchema = z.object({
  produit_id: z.number().int().positive(),
  quantite: z.coerce.number().int().positive(),
  priorite: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).default('NORMAL'),
  client_id: z.number().int().nullable().optional(),
  chef_projet_id: z.number().int().nullable().optional(),
  atelier: z.string().default('Atelier A'),
  date_echeance: z.string().min(1, 'Date echeance required'),
  plan_numero: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  operations: z.array(operationSchema).default([]),
  bom_overrides: z.array(bomOverrideSchema).default([]),
});

const updateOFStatusSchema = z.object({
  statut: z.enum(['DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

const operationUpdateSchema = z.object({
  statut: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
  notes: z.string().nullable().optional(),
});

const cancelSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

// ─── GET /api/of ────────────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { limit, offset, sort, order, search } = parsePagination(req.query);
    const statutFilter = req.query.statut as string | undefined;
    const prioriteFilter = req.query.priorite as string | undefined;

    let where = 'WHERE of.actif != false';
    const params: any[] = [];
    let pIdx = 1;

    if (statutFilter) { params.push(statutFilter); where += ` AND of.statut = $${pIdx++}`; }
    if (prioriteFilter) { params.push(prioriteFilter); where += ` AND of.priorite = $${pIdx++}`; }
    if (search) {
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      where += ` AND (of.numero ILIKE $${pIdx} OR p.nom ILIKE $${pIdx + 1} OR c.nom ILIKE $${pIdx + 2})`;
      pIdx += 3;
    }

    const countRes = await query<{ total: string }>(
      `SELECT COUNT(*) as total FROM ordres_fabrication of
       JOIN produits p ON p.id = of.produit_id
       LEFT JOIN clients c ON c.id = of.client_id ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].total);

    const { rows } = await query(
      `SELECT of.*, p.nom as produit_nom, p.code as produit_code,
              c.nom as client_nom, c.code as client_code,
              cp.prenom as chef_prenom, cp.nom as chef_nom,
              bl.numero as bl_numero, bl.statut as bl_statut,
              (SELECT json_agg(json_build_object(
                'id', op.id, 'operation_nom', op.operation_nom, 'statut', op.statut,
                'ordre', op.ordre, 'debut', op.debut, 'fin', op.fin,
                'machine_nom', m.nom,
                'operateurs_noms', (
                  SELECT STRING_AGG(DISTINCT o.prenom || ' ' || o.nom, ', ')
                  FROM op_operateurs oo
                  JOIN operateurs o ON o.id = oo.operateur_id
                  WHERE oo.operation_id = op.id
                )
              ) ORDER BY op.ordre)
               FROM of_operations op
               LEFT JOIN machines m ON m.id = op.machine_id
               WHERE op.of_id = of.id
              ) as operations
       FROM ordres_fabrication of
       JOIN produits p ON p.id = of.produit_id
       LEFT JOIN clients c ON c.id = of.client_id
       LEFT JOIN operateurs cp ON cp.id = of.chef_projet_id
       LEFT JOIN bons_livraison bl ON bl.of_id = of.id
       ${where}
       ORDER BY of.created_at DESC
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: { total, limit, offset, has_more: (offset || 0) + rows.length < total },
    });
  } catch (err) {
    console.error('Get OFs error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get production orders'));
  }
});

// ─── GET /api/of/:id ────────────────────────────────────────────

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT of.*, p.nom as produit_nom, p.code as produit_code, p.prix_vente_ht as produit_prix,
              p.unite as produit_unite, c.nom as client_nom,
              cp.prenom as chef_prenom, cp.nom as chef_nom,
              bl.numero as bl_numero, bl.statut as bl_statut
       FROM ordres_fabrication of
       JOIN produits p ON p.id = of.produit_id
       LEFT JOIN clients c ON c.id = of.client_id
       LEFT JOIN operateurs cp ON cp.id = of.chef_projet_id
       LEFT JOIN bons_livraison bl ON bl.of_id = of.id
       WHERE of.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'OF not found'));

    // Get operations
    const ops = await query(
      `SELECT op.*, m.nom as machine_nom,
              (SELECT STRING_AGG(DISTINCT o.prenom || ' ' || o.nom, ', ')
               FROM op_operateurs oo JOIN operateurs o ON o.id = oo.operateur_id
               WHERE oo.operation_id = op.id) as operateurs_noms
       FROM of_operations op LEFT JOIN machines m ON m.id = op.machine_id
       WHERE op.of_id = $1 ORDER BY op.ordre`,
      [req.params.id]
    );

    // Get BOM overrides
    const bom = await query(
      `SELECT ob.*, m.nom as materiau_nom, m.code as materiau_code, m.unite, m.stock_actuel
       FROM of_bom ob JOIN materiaux m ON m.id = ob.materiau_id
       WHERE ob.of_id = $1`,
      [req.params.id]
    );

    // Get product BOM if no overrides
    const productBom = bom.rows.length === 0 ? await query(
      `SELECT b.*, m.nom as materiau_nom, m.code as materiau_code, m.unite, m.stock_actuel
       FROM bom b JOIN materiaux m ON m.id = b.materiau_id
       WHERE b.produit_id = $1`,
      [rows[0].produit_id]
    ) : { rows: [] };

    res.json({
      ...rows[0],
      operations: ops.rows,
      bom: bom.rows,
      product_bom: productBom.rows,
    });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get OF'));
  }
});

// ─── POST /api/of ───────────────────────────────────────────────

router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = createOFSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));
  }

  const data = parsed.data;

  try {
    const result = await transaction(async (q) => {
      // Create OF
      const numero = await nextCode('OF');
      const ofRes = await q(
        `INSERT INTO ordres_fabrication (numero, produit_id, quantite, priorite, statut, client_id, chef_projet_id, atelier, date_echeance, plan_numero, notes)
         VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [numero, data.produit_id, data.quantite, data.priorite, data.client_id || null, data.chef_projet_id || null, data.atelier, data.date_echeance, data.plan_numero || null, data.notes || null]
      );
      const ofId = ofRes.rows[0].id;

      // Create operations
      for (const op of data.operations) {
        await q(
          `INSERT INTO of_operations (of_id, operation_nom, machine_id, ordre, duree_prevue, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [ofId, op.operation_nom, op.machine_id || null, op.ordre, op.duree_prevue || null, op.notes || null]
        );
      }

      // Create BOM overrides
      for (const bom of data.bom_overrides) {
        await q(
          `INSERT INTO of_bom (of_id, materiau_id, quantite_requise) VALUES ($1, $2, $3)
           ON CONFLICT (of_id, materiau_id) DO UPDATE SET quantite_requise = EXCLUDED.quantite_requise`,
          [ofId, bom.materiau_id, bom.quantite_requise]
        );
      }

      // Auto-create BL
      const blNumero = await nextCode('BL');
      await q(
        `INSERT INTO bons_livraison (numero, of_id, statut) VALUES ($1, $2, 'EMIS')`,
        [blNumero, ofId]
      );

      return { ofId, numero, bl_numero: blNumero };
    });

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'CREATE',
      entity_type: 'ordres_fabrication', entity_id: result.ofId, entity_numero: result.numero,
      detail: `OF created: ${result.numero}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.status(201).json({ numero: result.numero, bl_numero: result.bl_numero, das_crees: [] });
  } catch (err) {
    console.error('Create OF error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create OF'));
  }
});

// ─── PUT /api/of/:id (status advance) ──────────────────────────

router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = updateOFStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid statut'));
  }

  const newStatut = parsed.data.statut;

  try {
    await transaction(async (q) => {
      // Lock the OF row
      const ofRes = await q('SELECT * FROM ordres_fabrication WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (ofRes.rows.length === 0) throw new Error('OF not found');
      const current = ofRes.rows[0].statut;

      // Validate state transitions
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['APPROVED', 'CANCELLED'],
        APPROVED: ['IN_PROGRESS', 'DRAFT', 'CANCELLED'],
        IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [],
        CANCELLED: [],
      };

      if (!validTransitions[current]?.includes(newStatut)) {
        throw new Error(`Invalid transition: ${current} -> ${newStatut}`);
      }

      await q('UPDATE ordres_fabrication SET statut = $1 WHERE id = $2', [newStatut, req.params.id]);
    });

    res.json({ message: `OF status updated to ${newStatut}` });
  } catch (err: any) {
    if (err.message?.includes('Invalid transition') || err.message?.includes('not found')) {
      return res.status(400).json(apiError('VALIDATION_ERROR', err.message));
    }
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update OF'));
  }
});

// ─── PUT /api/of/:id/full ───────────────────────────────────────

router.put('/:id/full', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = createOFSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));
  }

  const data = parsed.data;

  try {
    await transaction(async (q) => {
      // Update OF
      await q(
        `UPDATE ordres_fabrication SET produit_id = $1, quantite = $2, priorite = $3, client_id = $4,
         chef_projet_id = $5, atelier = $6, date_echeance = $7, plan_numero = $8, notes = $9
         WHERE id = $10`,
        [data.produit_id, data.quantite, data.priorite, data.client_id || null, data.chef_projet_id || null, data.atelier, data.date_echeance, data.plan_numero || null, data.notes || null, req.params.id]
      );

      // Replace operations
      await q('DELETE FROM of_operations WHERE of_id = $1', [req.params.id]);
      for (const op of data.operations) {
        await q(
          `INSERT INTO of_operations (of_id, operation_nom, machine_id, ordre, duree_prevue, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.params.id, op.operation_nom, op.machine_id || null, op.ordre, op.duree_prevue || null, op.notes || null]
        );
      }

      // Replace BOM overrides
      await q('DELETE FROM of_bom WHERE of_id = $1', [req.params.id]);
      for (const bom of data.bom_overrides) {
        await q(
          `INSERT INTO of_bom (of_id, materiau_id, quantite_requise) VALUES ($1, $2, $3)
           ON CONFLICT (of_id, materiau_id) DO UPDATE SET quantite_requise = EXCLUDED.quantite_requise`,
          [req.params.id, bom.materiau_id, bom.quantite_requise]
        );
      }
    });

    res.json({ message: 'OF updated' });
  } catch (err) {
    console.error('Full update OF error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update OF'));
  }
});

// ─── PUT /api/of/:id/cancel ────────────────────────────────────

router.put('/:id/cancel', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = cancelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Reason must be at least 5 characters'));
  }

  try {
    await transaction(async (q) => {
      const ofRes = await q('SELECT * FROM ordres_fabrication WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (ofRes.rows.length === 0) throw new Error('OF not found');
      const of = ofRes.rows[0];
      if (of.statut === 'CANCELLED') throw new Error('OF already cancelled');

      await q(
        `UPDATE ordres_fabrication SET statut = 'CANCELLED', cancel_reason = $1, cancelled_by = $2, cancelled_at = NOW() WHERE id = $3`,
        [parsed.data.reason, req.user!.userId, req.params.id]
      );

      // Cascade cancel BL
      await q("UPDATE bons_livraison SET statut = 'CANCELLED', cancel_reason = $1 WHERE of_id = $2", [parsed.data.reason, req.params.id]);

      // Cascade cancel DAs
      await q("UPDATE demandes_achat SET statut = 'CANCELLED' WHERE of_id = $1 AND statut IN ('PENDING', 'APPROVED')", [req.params.id]);

      const hasStartedOps = await q("SELECT COUNT(*) FROM of_operations WHERE of_id = $1 AND statut IN ('IN_PROGRESS', 'COMPLETED')", [req.params.id]);
      const suggestNc = parseInt(hasStartedOps.rows[0].count) > 0;

      res.json({ message: 'OF cancelled', suggest_nc: suggestNc });
    });
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('already')) {
      return res.status(400).json(apiError('VALIDATION_ERROR', err.message));
    }
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to cancel OF'));
  }
});

// ─── DELETE /api/of/:id ──────────────────────────────────────────

router.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    await transaction(async (q) => {
      const ofRes = await q('SELECT * FROM ordres_fabrication WHERE id = $1', [req.params.id]);
      if (ofRes.rows.length === 0) throw new Error('OF not found');
      const of = ofRes.rows[0];

      // Don't allow deleting COMPLETED OFs (use cancel instead)
      if (of.statut === 'COMPLETED') {
        throw new Error('Cannot delete a completed OF. Use cancel instead.');
      }

      // Delete BL if exists
      await q('DELETE FROM bons_livraison WHERE of_id = $1', [req.params.id]);

      // Delete operations and their op_operateurs
      const opsRes = await q('SELECT id FROM of_operations WHERE of_id = $1', [req.params.id]);
      for (const op of opsRes.rows) {
        await q('DELETE FROM op_operateurs WHERE operation_id = $1', [op.id]);
      }
      await q('DELETE FROM of_operations WHERE of_id = $1', [req.params.id]);

      // Delete BOM overrides
      await q('DELETE FROM of_bom WHERE of_id = $1', [req.params.id]);

      // Delete the OF
      await q('DELETE FROM ordres_fabrication WHERE id = $1', [req.params.id]);
    });

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'DELETE',
      entity_type: 'ordres_fabrication', entity_id: parseInt(req.params.id),
      detail: `OF deleted: ${req.params.id}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.json({ message: 'OF deleted' });
  } catch (err: any) {
    if (err.message?.includes('not found')) return res.status(404).json(apiError('NOT_FOUND', err.message));
    if (err.message?.includes('completed')) return res.status(400).json(apiError('VALIDATION_ERROR', err.message));
    console.error('Delete OF error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to delete OF'));
  }
});

// ─── POST /api/of/:id/duplicate ──────────────────────────────────────

const duplicateSchema = z.object({
  quantite: z.coerce.number().int().positive().default(1),
  priorite: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).default('NORMAL'),
  date_echeance: z.string().min(1),
  client_id: z.number().int().nullable().optional(),
  chef_projet_id: z.number().int().nullable().optional(),
  plan_numero: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.post('/:id/duplicate', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = duplicateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data', parsed.error.issues.map(i => ({ field: i.path.join('.'), issue: i.message }))));
  }

  const data = parsed.data;

  try {
    const result = await transaction(async (q) => {
      // Get source OF
      const srcRes = await q(
        `SELECT * FROM ordres_fabrication WHERE id = $1`,
        [req.params.id]
      );
      if (srcRes.rows.length === 0) throw new Error('Source OF not found');
      const src = srcRes.rows[0];

      // Create new OF (as DRAFT)
      const ofSeqRes = await q(
        `INSERT INTO document_sequences (prefix, year, last_seq) VALUES ('OF', EXTRACT(YEAR FROM CURRENT_DATE)::int, 0)
         ON CONFLICT (prefix, year) DO UPDATE SET last_seq = document_sequences.last_seq + 1
         RETURNING last_seq`
      );
      const ofSeq = ofSeqRes.rows[0].last_seq;
      const numero = `OF-${new Date().getFullYear()}-${String(ofSeq).padStart(4, '0')}`;
      const ofRes = await q(
        `INSERT INTO ordres_fabrication (numero, produit_id, quantite, priorite, statut, client_id, chef_projet_id, atelier, date_echeance, plan_numero, notes)
         VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [numero, src.produit_id, data.quantite, data.priorite, data.client_id ?? src.client_id, data.chef_projet_id ?? src.chef_projet_id, src.atelier, data.date_echeance, data.plan_numero ?? src.plan_numero, data.notes ?? src.notes]
      );
      const newOfId = ofRes.rows[0].id;

      // Copy operations
      const opsRes = await q('SELECT * FROM of_operations WHERE of_id = $1 ORDER BY ordre', [req.params.id]);
      for (const op of opsRes.rows) {
        await q(
          `INSERT INTO of_operations (of_id, operation_nom, machine_id, ordre, duree_prevue, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newOfId, op.operation_nom, op.machine_id, op.ordre, op.duree_prevue, op.notes]
        );
      }

      // Copy BOM overrides (use source product BOM if no overrides)
      const bomRes = await q('SELECT * FROM of_bom WHERE of_id = $1', [req.params.id]);
      if (bomRes.rows.length > 0) {
        for (const bom of bomRes.rows) {
          await q(
            `INSERT INTO of_bom (of_id, materiau_id, quantite_requise) VALUES ($1, $2, $3)`,
            [newOfId, bom.materiau_id, bom.quantite_requise]
          );
        }
      } else {
        // Copy source product's BOM
        const srcBomRes = await q('SELECT * FROM bom WHERE produit_id = $1', [src.produit_id]);
        for (const bom of srcBomRes.rows) {
          await q(
            `INSERT INTO of_bom (of_id, materiau_id, quantite_requise) VALUES ($1, $2, $3)`,
            [newOfId, bom.materiau_id, bom.quantite_par_unite]
          );
        }
      }

      // Auto-create BL (use query inside transaction for BL number)
      const blSeqRes = await q(
        `INSERT INTO document_sequences (prefix, year, last_seq) VALUES ('BL', EXTRACT(YEAR FROM CURRENT_DATE)::int, 0)
         ON CONFLICT (prefix, year) DO UPDATE SET last_seq = document_sequences.last_seq + 1
         RETURNING last_seq`
      );
      const blSeq = blSeqRes.rows[0].last_seq;
      const blNumero = `BL-${new Date().getFullYear()}-${String(blSeq).padStart(4, '0')}`;
      await q(
        `INSERT INTO bons_livraison (numero, of_id, statut) VALUES ($1, $2, 'EMIS')`,
        [blNumero, newOfId]
      );

      return { numero, bl_numero: blNumero, operations_count: opsRes.rows.length, bom_count: bomRes.rows.length };
    });

    await logActivity({
      user_id: req.user!.userId, user_nom: req.user!.nom, action: 'CREATE',
      entity_type: 'ordres_fabrication', entity_numero: result.numero,
      detail: `OF duplicated from ${req.params.id} to ${result.numero}`, ip_address: req.ip || undefined, session_token: req.user!.sessionToken,
    });

    res.status(201).json({
      numero: result.numero,
      bl_numero: result.bl_numero,
      operations_count: result.operations_count,
      bom_count: result.bom_count,
    });
  } catch (err: any) {
    console.error('Duplicate OF error:', err?.message || err);
    if (err.message?.includes('not found')) return res.status(404).json(apiError('NOT_FOUND', err.message));
    res.status(500).json(apiError('INTERNAL_ERROR', err?.message || 'Failed to duplicate OF'));
  }
});

// ─── OF Operations ──────────────────────────────────────────────

router.get('/:of_id/operations', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT op.*, m.nom as machine_nom,
              (SELECT STRING_AGG(DISTINCT o.prenom || ' ' || o.nom, ', ')
               FROM op_operateurs oo JOIN operateurs o ON o.id = oo.operateur_id
               WHERE oo.operation_id = op.id) as operateurs_noms
       FROM of_operations op LEFT JOIN machines m ON m.id = op.machine_id
       WHERE op.of_id = $1 ORDER BY op.ordre`,
      [req.params.of_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get operations'));
  }
});

router.post('/:of_id/operations', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = operationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid operation'));

  try {
    const { rows } = await query(
      `INSERT INTO of_operations (of_id, operation_nom, machine_id, ordre, duree_prevue, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.of_id, parsed.data.operation_nom, parsed.data.machine_id || null, parsed.data.ordre, parsed.data.duree_prevue || null, parsed.data.notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to create operation'));
  }
});

router.put('/:of_id/operations/:op_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = operationUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid operation update'));

  try {
    const result = await transaction(async (q) => {
      // Lock operation
      const opRes = await q('SELECT * FROM of_operations WHERE id = $1 FOR UPDATE', [req.params.op_id]);
      if (opRes.rows.length === 0) throw new Error('Operation not found');
      const op = opRes.rows[0];

      const newStatus = parsed.data.statut;
      const currentDate = new Date();

      // Validate ordering: can't start op N until 0..N-1 are COMPLETED
      if (newStatus === 'IN_PROGRESS') {
        const prevOps = await q(
          "SELECT COUNT(*) as incomplete FROM of_operations WHERE of_id = $1 AND ordre < $2 AND statut != 'COMPLETED'",
          [op.of_id, op.ordre]
        );
        if (parseInt(prevOps.rows[0].incomplete) > 0) {
          throw new Error('Previous operations must be completed first');
        }
      }

      // Build update
      let debut = op.debut;
      let fin = op.fin;

      if (newStatus === 'IN_PROGRESS' && !debut) debut = currentDate;
      if (newStatus === 'COMPLETED') {
        debut = debut || currentDate;
        fin = currentDate;
      }
      if (newStatus === 'PENDING') { debut = null; fin = null; }

      await q(
        'UPDATE of_operations SET statut = $1, debut = $2, fin = $3, notes = $4 WHERE id = $5',
        [newStatus, debut, fin, parsed.data.notes || op.notes, req.params.op_id]
      );

      // Auto-sync OF status
      const ops = await q("SELECT statut, COUNT(*) as cnt FROM of_operations WHERE of_id = $1 GROUP BY statut", [op.of_id]);
      const statusCounts: Record<string, number> = {};
      ops.rows.forEach((r: any) => { statusCounts[r.statut] = parseInt(r.cnt); });
      const total = Object.values(statusCounts).reduce((a: number, b: any) => a + b, 0);

      let ofStatut = 'APPROVED';
      if (statusCounts['COMPLETED'] === total) ofStatut = 'COMPLETED';
      else if (statusCounts['IN_PROGRESS'] > 0 || statusCounts['COMPLETED'] > 0) ofStatut = 'IN_PROGRESS';

      await q('UPDATE ordres_fabrication SET statut = $1 WHERE id = $2', [ofStatut, op.of_id]);

      return { statut: newStatus, of_statut: ofStatut };
    });

    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('Previous')) {
      return res.status(400).json(apiError('VALIDATION_ERROR', err.message));
    }
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update operation'));
  }
});

// ─── OF BOM ─────────────────────────────────────────────────────

router.get('/:of_id/bom', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Check overrides first
    const { rows: overrides } = await query(
      `SELECT ob.*, m.nom as materiau_nom, m.code as materiau_code, m.unite, m.stock_actuel
       FROM of_bom ob JOIN materiaux m ON m.id = ob.materiau_id WHERE ob.of_id = $1`,
      [req.params.of_id]
    );

    if (overrides.length > 0) return res.json(overrides);

    // Fall back to product BOM
    const { rows } = await query(
      `SELECT b.*, m.nom as materiau_nom, m.code as materiau_code, m.unite, m.stock_actuel
       FROM bom b JOIN materiaux m ON m.id = b.materiau_id
       WHERE b.produit_id = (SELECT produit_id FROM ordres_fabrication WHERE id = $1)`,
      [req.params.of_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get BOM'));
  }
});

router.put('/:of_id/bom', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const parsed = z.array(bomOverrideSchema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid BOM overrides'));

  try {
    await transaction(async (q) => {
      await q('DELETE FROM of_bom WHERE of_id = $1', [req.params.of_id]);
      for (const bom of parsed.data) {
        await q(
          `INSERT INTO of_bom (of_id, materiau_id, quantite_requise) VALUES ($1, $2, $3)`,
          [req.params.of_id, bom.materiau_id, bom.quantite_requise]
        );
      }
    });
    res.json({ message: 'BOM overrides updated' });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to update BOM overrides'));
  }
});

export { router as ofRouter };


