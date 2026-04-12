import { MigrationBuilder } from 'node-pg-migrate';

export async function down(pgm: MigrationBuilder): Promise<void> {
  // ==========================================
  // DROP ALL TABLES (in reverse dependency order)
  // ==========================================
  
  // Join tables and dependency tables first
  pgm.dropTable('materiau_fournisseurs', { ifExists: true });
  pgm.dropTable('op_operateurs', { ifExists: true });
  pgm.dropTable('of_bom', { ifExists: true });
  pgm.dropTable('bom', { ifExists: true });
  pgm.dropTable('br_lignes', { ifExists: true });
  pgm.dropTable('bc_lignes', { ifExists: true });

  // Main business tables
  pgm.dropTable('activity_log_v2', { ifExists: true });
  pgm.dropTable('mouvements_stock', { ifExists: true });
  pgm.dropTable('settings', { ifExists: true });
  pgm.dropTable('operation_types', { ifExists: true });
  pgm.dropTable('non_conformites', { ifExists: true });
  pgm.dropTable('controle_qualite', { ifExists: true });
  pgm.dropTable('planning_slots', { ifExists: true });
  pgm.dropTable('maintenance_orders', { ifExists: true });
  pgm.dropTable('factures_achat', { ifExists: true });
  pgm.dropTable('bons_reception', { ifExists: true });
  pgm.dropTable('bons_commande', { ifExists: true });
  pgm.dropTable('demandes_achat', { ifExists: true });
  pgm.dropTable('bons_livraison', { ifExists: true });
  pgm.dropTable('of_operations', { ifExists: true });
  pgm.dropTable('ordres_fabrication', { ifExists: true });
  pgm.dropTable('fournisseurs', { ifExists: true });
  pgm.dropTable('machines', { ifExists: true });
  pgm.dropTable('materiaux', { ifExists: true });
  pgm.dropTable('produits', { ifExists: true });
  pgm.dropTable('operateurs', { ifExists: true });
  pgm.dropTable('clients', { ifExists: true });
  pgm.dropTable('users', { ifExists: true });
  pgm.dropTable('document_sequences', { ifExists: true });

  // ==========================================
  // DROP TRIGGER FUNCTION
  // ==========================================
  pgm.dropFunction('update_updated_at_column', [], { ifExists: true });

  // ==========================================
  // DROP DOCUMENT SEQUENCING FUNCTIONS
  // ==========================================
  pgm.dropFunction('nextCode', [{ name: 'p_prefix', mode: 'in', type: 'VARCHAR' }], { ifExists: true });
  pgm.dropFunction('finalizeNumber', [{ name: 'p_prefix', mode: 'in', type: 'VARCHAR' }], { ifExists: true });
  pgm.dropFunction('nextSeq', [
    { name: 'p_prefix', mode: 'in', type: 'VARCHAR' },
    { name: 'p_year', mode: 'in', type: 'SMALLINT' }
  ], { ifExists: true });

  // ==========================================
  // DROP EXTENSIONS
  // ==========================================
  pgm.dropExtension('pgcrypto', { ifExists: true });
  pgm.dropExtension('uuid-ossp', { ifExists: true });
}
