import { Router, Response } from 'express';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { query } from '../db/pool.js';
import { apiError } from '../utils/helpers.js';

const router = Router();

// ─── GET /api/settings ────────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT id, groupe, cle, valeur, type, description FROM settings ORDER BY groupe, cle`
    );
    // Parse values to correct types
    const parsed = rows.map((r: any) => {
      let value: any = r.valeur;
      if (r.type === 'boolean') value = ['true', '1', 'yes', 'oui'].includes(String(value).toLowerCase());
      else if (r.type === 'number') value = isNaN(Number(value)) ? 0 : Number(value);
      return { ...r, valeur: value };
    });
    res.json({ data: parsed });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to get settings'));
  }
});

// ─── PUT /api/settings/bulk ──────────────────────────────────────────

router.put('/bulk', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Settings object required'));
  }

  try {
    const entries = Object.entries(settings);
    for (const [cle, valeur] of entries) {
      // Determine type from current setting or infer
      const current = await query('SELECT type FROM settings WHERE cle = $1', [cle]);
      let type = 'string';
      if (current.rows.length > 0) {
        type = current.rows[0].type;
      } else if (typeof valeur === 'boolean') {
        type = 'boolean';
      } else if (typeof valeur === 'number') {
        type = 'number';
      }

      const valeurStr = String(valeur);

      await query(
        `INSERT INTO settings (groupe, cle, valeur, type)
         VALUES ('general', $1, $2, $3)
         ON CONFLICT (cle) DO UPDATE SET valeur = $2, type = $3, updated_at = CURRENT_TIMESTAMP`,
        [cle, valeurStr, type]
      );
    }

    res.json({ message: `${entries.length} settings saved`, count: entries.length });
  } catch (err) {
    console.error('Bulk settings error:', err);
    res.status(500).json(apiError('INTERNAL_ERROR', 'Failed to save settings'));
  }
});

export { router as settingsRouter };
