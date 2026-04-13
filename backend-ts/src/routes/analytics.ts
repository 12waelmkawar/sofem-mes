import { Router, Response } from 'express';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { apiError } from '../utils/helpers.js';

const router = Router();

// ─── GET /api/analytics/production ─────────────────────────────

router.get('/production', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parMois = await query(
      `SELECT TO_CHAR(date_trunc('month', created_at), 'Mon YY') as mois_label,
              COUNT(*) as total, COUNT(*) FILTER (WHERE statut = 'COMPLETED') as completes
       FROM ordres_fabrication
       WHERE created_at >= CURRENT_DATE - INTERVAL '12 months' AND actif != false
       GROUP BY date_trunc('month', created_at) ORDER BY date_trunc('month', created_at)`
    );

    const statuts = await query(
      `SELECT statut, COUNT(*) as n FROM ordres_fabrication WHERE actif != false GROUP BY statut`
    );

    const retards = await query(
      `SELECT numero, p.nom as produit_nom, c.nom as client_nom, statut, statut,
              (CURRENT_DATE - date_echeance) as jours_retard
       FROM ordres_fabrication of
       JOIN produits p ON p.id = of.produit_id
       LEFT JOIN clients c ON c.id = of.client_id
       WHERE date_echeance < CURRENT_DATE AND statut NOT IN ('COMPLETED', 'CANCELLED')
       ORDER BY jours_retard DESC`
    );

    const ateliers = await query(
      `SELECT atelier, COUNT(*) as n FROM ordres_fabrication WHERE actif != false GROUP BY atelier ORDER BY n DESC`
    );

    res.json({
      par_mois: parMois.rows.map((r: any) => ({ ...r, total: parseInt(r.total), completes: parseInt(r.completes) })),
      statuts: statuts.rows.map((r: any) => ({ ...r, n: parseInt(r.n) })),
      retards: retards.rows,
      ateliers: ateliers.rows.map((r: any) => ({ ...r, n: parseInt(r.n) })),
    });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get analytics'));
  }
});

// ─── GET /api/analytics/achats ─────────────────────────────────

router.get('/achats', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const stock = await query(
      `SELECT nom, CASE WHEN stock_minimum > 0 THEN ROUND(stock_actuel::numeric / stock_minimum::numeric * 100, 1) ELSE 100 END as pct_stock,
              stock_actuel, stock_minimum, unite
       FROM materiaux WHERE actif = true ORDER BY pct_stock ASC LIMIT 20`
    );

    const valeur = await query('SELECT COALESCE(SUM(stock_actuel * prix_unitaire), 0) as valeur FROM materiaux WHERE actif = true');

    const daStatuts = await query("SELECT statut, COUNT(*) as n FROM demandes_achat GROUP BY statut");

    const topFournisseurs = await query(
      `SELECT bc.fournisseur, COALESCE(SUM(bc.montant_ht), 0) as montant_total
       FROM bons_commande bc GROUP BY bc.fournisseur ORDER BY montant_total DESC LIMIT 10`
    );

    const mouvements = await query(
      `SELECT ms.*, m.nom as materiau_nom, m.code as materiau_code
       FROM mouvements_stock ms JOIN materiaux m ON m.id = ms.materiau_id
       ORDER BY ms.created_at DESC LIMIT 50`
    );

    res.json({
      stock: stock.rows,
      valeur_totale_stock: parseFloat(valeur.rows[0]?.valeur || '0'),
      da_statuts: daStatuts.rows.map((r: any) => ({ ...r, n: parseInt(r.n) })),
      top_fournisseurs: topFournisseurs.rows,
      mouvements: mouvements.rows,
    });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed'));
  }
});

// ─── GET /api/analytics/operateurs ─────────────────────────────

router.get('/operateurs', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const performance = await query(
      `SELECT o.id, o.prenom, o.nom, o.specialite, o.role, o.taux_horaire, o.taux_piece, o.type_taux,
              COUNT(DISTINCT op.of_id) as ops_terminees,
              COALESCE(SUM(op.duree_reelle), 0) as duree_totale_min,
              COUNT(DISTINCT of2.id) as ofs_impliques
       FROM operateurs o
       LEFT JOIN op_operateurs oo ON oo.operateur_id = o.id
       LEFT JOIN of_operations op ON op.id = oo.operation_id AND op.statut = 'COMPLETED'
       LEFT JOIN of_operations op2 ON op2.id = oo.operation_id
       LEFT JOIN ordres_fabrication of2 ON of2.id = op2.of_id
       WHERE o.actif = true
       GROUP BY o.id ORDER BY ops_terminees DESC`
    );

    const specialites = await query(
      `SELECT specialite, COUNT(*) as n FROM operateurs WHERE actif = true GROUP BY specialite ORDER BY n DESC`
    );

    res.json({
      performance: performance.rows.map((r: any) => ({
        ...r, ops_terminees: parseInt(r.ops_terminees),
        duree_totale_min: parseInt(r.duree_totale_min),
        ofs_impliques: parseInt(r.ofs_impliques),
      })),
      specialites: specialites.rows.map((r: any) => ({ ...r, n: parseInt(r.n) })),
    });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed'));
  }
});

// ─── GET /api/analytics/qualite ────────────────────────────────

router.get('/qualite', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const kpis = await query(
      `SELECT
        CASE WHEN SUM(quantite_controlee) > 0 THEN ROUND(SUM(quantite_conforme)::numeric / SUM(quantite_controlee) * 100, 1) ELSE 0 END as taux_global,
        COUNT(*) as total_cq,
        SUM(quantite_rebut) as total_rebut
       FROM controle_qualite`
    );

    const ncKpis = await query(
      `SELECT COUNT(*) FILTER (WHERE statut = 'OUVERTE') as ouvertes,
              COUNT(*) FILTER (WHERE gravite = 'CRITIQUE') as critiques
       FROM non_conformites`
    );

    const parMois = await query(
      `SELECT TO_CHAR(date_trunc('month', date_controle), 'Mon YY') as mois_label,
              CASE WHEN SUM(quantite_controlee) > 0 THEN ROUND(SUM(quantite_conforme)::numeric / SUM(quantite_controlee) * 100, 1) ELSE 0 END as taux
       FROM controle_qualite WHERE date_controle >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY date_trunc('month', date_controle) ORDER BY date_trunc('month', date_controle)`
    );

    const defauts = await query(
      `SELECT type_defaut, COUNT(*) as n FROM non_conformites GROUP BY type_defaut ORDER BY n DESC`
    );

    const ncOuvertes = await query(
      `SELECT nc.nc_numero, of.numero as of_numero, p.nom as produit_nom,
              nc.type_defaut, nc.gravite, resp.prenom as resp_prenom, resp.nom as resp_nom,
              nc.action_corrective, nc.statut,
              EXTRACT(DAY FROM CURRENT_DATE - nc.created_at) as age_jours
       FROM non_conformites nc
       LEFT JOIN ordres_fabrication of ON of.id = nc.of_id
       LEFT JOIN produits p ON p.id = of.produit_id
       LEFT JOIN operateurs resp ON resp.id = nc.responsable_id
       WHERE nc.statut IN ('OUVERTE', 'EN_COURS')
       ORDER BY age_jours DESC`
    );

    res.json({
      kpis: kpis.rows[0],
      nc_kpis: ncKpis.rows[0],
      par_mois: parMois.rows,
      defauts: defauts.rows.map((r: any) => ({ ...r, n: parseInt(r.n) })),
      nc_ouvertes: ncOuvertes.rows,
    });
  } catch (err) {
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed'));
  }
});

// ─── Planning ──────────────────────────────────────────────────

const planningRouter = Router();

planningRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT ps.*, of.numero as of_numero, p.nom as produit_nom,
              m.nom as machine_nom, o.prenom as operateur_prenom, o.nom as operateur_nom
       FROM planning_slots ps
       JOIN ordres_fabrication of ON of.id = ps.of_id
       JOIN produits p ON p.id = of.produit_id
       LEFT JOIN machines m ON m.id = ps.machine_id
       LEFT JOIN operateurs o ON o.id = ps.operateur_id
       ORDER BY ps.date_debut`
    );
    res.json(rows);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed')); }
});

planningRouter.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { of_id, machine_id, operateur_id, date_debut, date_fin, statut, notes } = req.body;
  if (!of_id || !date_debut || !date_fin) return res.status(400).json(apiError('VALIDATION_ERROR', 'Required fields missing'));
  if (new Date(date_fin) <= new Date(date_debut)) return res.status(400).json(apiError('VALIDATION_ERROR', 'date_fin must be after date_debut'));
  try {
    const { rows } = await query(
      `INSERT INTO planning_slots (of_id, machine_id, operateur_id, date_debut, date_fin, statut, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [of_id, machine_id || null, operateur_id || null, date_debut, date_fin, statut || 'PLANIFIE', notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed')); }
});

planningRouter.delete('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM planning_slots WHERE id = $1', [req.params.id]);
    res.json({ message: 'Slot deleted' });
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed')); }
});

planningRouter.get('/gantt', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT ps.id, ps.of_id, of.numero as of_numero, p.nom as produit_nom,
              m.nom as machine_nom, ps.date_debut, ps.date_fin, ps.statut,
              o.prenom || ' ' || o.nom as operateur_nom
       FROM planning_slots ps
       JOIN ordres_fabrication of ON of.id = ps.of_id
       JOIN produits p ON p.id = of.produit_id
       LEFT JOIN machines m ON m.id = ps.machine_id
       LEFT JOIN operateurs o ON o.id = ps.operateur_id
       ORDER BY ps.date_debut`
    );
    res.json(rows);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed')); }
});

// ─── Fournisseurs ──────────────────────────────────────────────

const fournisseursRouter = Router();
const createFournSchema = { nom: '', contact: '', telephone: '', email: '', ville: 'Sfax', pays: 'Tunisie', matricule_fiscal: '', notes: '' };

fournisseursRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query('SELECT * FROM fournisseurs WHERE actif = true ORDER BY code LIMIT 500');
    res.json(rows);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed')); }
});

fournisseursRouter.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const d = { ...createFournSchema, ...req.body };
  if (!d.nom) return res.status(400).json(apiError('VALIDATION_ERROR', 'Nom required'));
  try {
    const prefix = 'FOURN';
    const year = new Date().getFullYear();
    const codeRes = await query(
      `INSERT INTO document_sequences (prefix, year, last_seq) VALUES ($1, $2, 0)
       ON CONFLICT (prefix, year) DO UPDATE SET last_seq = document_sequences.last_seq + 1
       RETURNING last_seq`, [prefix, year]
    );
    const code = `${prefix}-${year}-${String(codeRes.rows[0].last_seq).padStart(4, '0')}`;
    const { rows } = await query(
      `INSERT INTO fournisseurs (code, nom, contact, telephone, email, ville, pays, matricule_fiscal, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [code, d.nom, d.contact || null, d.telephone || null, d.email || null, d.ville, d.pays, d.matricule_fiscal || null, d.notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed')); }
});

fournisseursRouter.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { statut, ...rest } = req.body;
  const fields: string[] = []; const values: any[] = []; let idx = 1;
  const setIf = (k: string, v: any) => { if (v !== undefined) { fields.push(`${k} = $${idx++}`); values.push(v); } };
  Object.entries(rest).forEach(([k, v]) => setIf(k, v));
  if (statut) setIf('statut', statut);
  if (fields.length === 0) return res.status(400).json(apiError('VALIDATION_ERROR', 'No fields'));
  values.push(req.params.id);
  try {
    const { rows } = await query(`UPDATE fournisseurs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (rows.length === 0) return res.status(404).json(apiError('NOT_FOUND', 'Not found'));
    res.json(rows[0]);
  } catch (err) { res.status(500).json(apiError('INTERNAL_ERROR', 'Failed')); }
});

export { router as analyticsRouter, planningRouter, fournisseursRouter };
