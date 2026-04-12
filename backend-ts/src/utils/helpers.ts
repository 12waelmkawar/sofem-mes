import { query } from '../db/pool.js';

// ─── Document Numbering ────────────────────────────────────────

export async function nextCode(prefix: string, year?: number): Promise<string> {
  const y = year || new Date().getFullYear();
  const { rows } = await query<{ last_seq: number }>(
    `INSERT INTO document_sequences (prefix, year, last_seq)
     VALUES ($1, $2, 0)
     ON CONFLICT (prefix, year) DO UPDATE SET last_seq = document_sequences.last_seq + 1
     RETURNING last_seq`,
    [prefix, y]
  );
  const seq = rows[0].last_seq;
  return `${prefix}-${y}-${String(seq).padStart(4, '0')}`;
}

// ─── Pagination Helper ─────────────────────────────────────────

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
  search?: string;
}

export function parsePagination(query: any): PaginationParams {
  return {
    limit: Math.min(parseInt(query.limit) || 50, 500),
    offset: parseInt(query.offset) || 0,
    sort: query.sort || 'created_at',
    order: (query.order || 'DESC').toUpperCase() as 'ASC' | 'DESC',
    search: query.search || undefined,
  };
}

// ─── Activity Logging ──────────────────────────────────────────

export async function logActivity(params: {
  user_id?: number;
  user_nom?: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  entity_numero?: string;
  detail?: string;
  old_value?: any;
  new_value?: any;
  reason?: string;
  ip_address?: string;
  session_token?: string;
}): Promise<void> {
  try {
    const { user_id, user_nom, action, entity_type, entity_id, entity_numero, detail, old_value, new_value, reason, ip_address, session_token } = params;

    // Serialize JSON values safely
    const serialize = (v: any) => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'object') {
        return JSON.stringify(v, (_, val) =>
          typeof val === 'bigint' ? val.toString() : val instanceof Date ? val.toISOString() : val
        );
      }
      return String(v);
    };

    await query(
      `INSERT INTO activity_log_v2 (user_id, user_nom, action, entity_type, entity_id, entity_numero, old_value, new_value, reason, ip_address, session_token, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [user_id, user_nom, action, entity_type, entity_id, entity_numero, serialize(old_value), serialize(new_value), reason, ip_address, session_token, detail]
    );
  } catch {
    // Silent fail — logging should never break the main operation
  }
}

// ─── Standard Error Response ───────────────────────────────────

export function apiError(code: string, message: string, details?: { field: string; issue: string }[]) {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}
