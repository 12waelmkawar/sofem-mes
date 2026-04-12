import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ==========================================
  // ENABLE EXTENSIONS
  // ==========================================
  pgm.createExtension('uuid-ossp', { ifNotExists: true });
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  // ==========================================
  // UPDATED_AT TRIGGER FUNCTION (section 9.30.4)
  // ==========================================
  pgm.createFunction({
    name: 'update_updated_at_column',
    language: 'plpgsql',
    returns: 'TRIGGER',
    replace: true,
    definition: `
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
    `
  });

  // ==========================================
  // DOCUMENT SEQUENCING FUNCTIONS (section 9.1)
  // ==========================================
  
  // nextSeq() - Get next sequence number
  pgm.createFunction({
    name: 'nextSeq',
    language: 'plpgsql',
    returns: 'TABLE(prefix VARCHAR, year SMALLINT, seq INTEGER)',
    replace: true,
    parameters: [
      { name: 'p_prefix', mode: 'in', type: 'VARCHAR' },
      { name: 'p_year', mode: 'in', type: 'SMALLINT' }
    ],
    definition: `
      BEGIN
        RETURN QUERY
        INSERT INTO document_sequences (prefix, year, last_seq)
        VALUES (p_prefix, p_year, 1)
        ON CONFLICT (prefix, year)
        DO UPDATE SET last_seq = document_sequences.last_seq + 1
        RETURNING document_sequences.prefix, document_sequences.year, document_sequences.last_seq AS seq;
      END;
    `
  });

  // finalizeNumber() - Get formatted document number
  pgm.createFunction({
    name: 'finalizeNumber',
    language: 'plpgsql',
    returns: 'VARCHAR',
    replace: true,
    parameters: [
      { name: 'p_prefix', mode: 'in', type: 'VARCHAR' }
    ],
    definition: `
      DECLARE
        v_year SMALLINT := EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT;
        v_seq INTEGER;
      BEGIN
        SELECT seq INTO v_seq FROM nextSeq(p_prefix, v_year);
        RETURN p_prefix || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
      END;
    `
  });

  // nextCode() - Alias for formatted code string
  pgm.createFunction({
    name: 'nextCode',
    language: 'plpgsql',
    returns: 'VARCHAR',
    replace: true,
    parameters: [
      { name: 'p_prefix', mode: 'in', type: 'VARCHAR' }
    ],
    definition: `
      DECLARE
        v_year SMALLINT := EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT;
        v_seq INTEGER;
      BEGIN
        SELECT seq INTO v_seq FROM nextSeq(p_prefix, v_year);
        RETURN p_prefix || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
      END;
    `
  });

  // ==========================================
  // 1. document_sequences (section 9.1)
  // ==========================================
  pgm.createTable('document_sequences', {
    prefix: { type: 'VARCHAR(20)', notNull: true },
    year: { type: 'SMALLINT', notNull: true },
    last_seq: { type: 'INTEGER', notNull: true, default: 0 },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  }, {
    constraints: {
      primaryKey: ['prefix', 'year']
    }
  });

  // ==========================================
  // 2. users (section 7.2)
  // ==========================================
  pgm.createTable('users', {
    id: { type: 'SERIAL', primaryKey: true },
    nom: { type: 'VARCHAR', notNull: true },
    prenom: { type: 'VARCHAR', notNull: true },
    role: { type: 'VARCHAR', notNull: true },
    pin_hash: { type: 'VARCHAR', notNull: true },
    operateur_id: { type: 'INTEGER', references: 'operateurs(id)', onDelete: 'SET NULL' },
    actif: { type: 'BOOLEAN', default: true },
    pin_must_change: { type: 'BOOLEAN', default: false },
    totp_secret: { type: 'VARCHAR' },
    totp_enabled: { type: 'BOOLEAN', default: false },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 3. clients (section 7.3)
  // ==========================================
  pgm.createTable('clients', {
    id: { type: 'SERIAL', primaryKey: true },
    code: { type: 'VARCHAR', unique: true },
    nom: { type: 'VARCHAR', notNull: true },
    matricule_fiscal: { type: 'VARCHAR' },
    telephone: { type: 'VARCHAR' },
    email: { type: 'VARCHAR' },
    adresse: { type: 'VARCHAR' },
    ville: { type: 'VARCHAR' },
    notes: { type: 'TEXT' },
    actif: { type: 'BOOLEAN', default: true },
    deactivated_by: { type: 'INTEGER', references: 'users(id)', onDelete: 'SET NULL' },
    deactivated_at: { type: 'TIMESTAMP' },
    deactivation_reason: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 4. operateurs (section 7.4)
  // ==========================================
  pgm.createTable('operateurs', {
    id: { type: 'SERIAL', primaryKey: true },
    nom: { type: 'VARCHAR', notNull: true },
    prenom: { type: 'VARCHAR', notNull: true },
    specialite: { type: 'VARCHAR', notNull: true },
    role: { type: 'VARCHAR', default: 'OPERATEUR' },
    telephone: { type: 'VARCHAR' },
    email: { type: 'VARCHAR' },
    taux_horaire: { type: 'DECIMAL(8,2)', default: 0 },
    taux_piece: { type: 'DECIMAL(8,2)', default: 0 },
    type_taux: { type: 'VARCHAR', default: 'HORAIRE' },
    actif: { type: 'BOOLEAN', default: true },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 5. produits (section 7.5)
  // ==========================================
  pgm.createTable('produits', {
    id: { type: 'SERIAL', primaryKey: true },
    code: { type: 'VARCHAR', unique: true },
    nom: { type: 'VARCHAR', notNull: true },
    description: { type: 'TEXT' },
    unite: { type: 'VARCHAR', default: 'pcs' },
    prix_vente_ht: { type: 'DECIMAL(10,2)', default: 0 },
    actif: { type: 'BOOLEAN', default: true },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 6. materiaux (section 9.7)
  // ==========================================
  pgm.createTable('materiaux', {
    id: { type: 'SERIAL', primaryKey: true },
    code: { type: 'VARCHAR', unique: true },
    nom: { type: 'VARCHAR', notNull: true },
    unite: { type: 'VARCHAR', notNull: true },
    stock_actuel: { type: 'DECIMAL(10,2)', default: 0 },
    stock_minimum: { type: 'DECIMAL(10,2)', default: 0 },
    fournisseur: { type: 'VARCHAR' },
    prix_unitaire: { type: 'DECIMAL(10,2)', default: 0 },
    actif: { type: 'BOOLEAN', default: true },
    deactivated_by: { type: 'INTEGER', references: 'users(id)', onDelete: 'SET NULL' },
    deactivated_at: { type: 'TIMESTAMP' },
    deactivation_reason: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 7. bom (section 9.6)
  // ==========================================
  pgm.createTable('bom', {
    produit_id: { type: 'INTEGER', notNull: true, references: 'produits(id)', onDelete: 'CASCADE' },
    materiau_id: { type: 'INTEGER', notNull: true, references: 'materiaux(id)', onDelete: 'CASCADE' },
    quantite_par_unite: { type: 'DECIMAL(8,3)', notNull: true }
  }, {
    constraints: {
      primaryKey: ['produit_id', 'materiau_id']
    }
  });

  // ==========================================
  // 8. ordres_fabrication (section 9.9)
  // ==========================================
  pgm.createTable('ordres_fabrication', {
    id: { type: 'SERIAL', primaryKey: true },
    numero: { type: 'VARCHAR', unique: true },
    produit_id: { type: 'INTEGER', notNull: true, references: 'produits(id)' },
    quantite: { type: 'INTEGER', notNull: true },
    priorite: { type: 'VARCHAR', default: 'NORMAL' },
    statut: { type: 'VARCHAR', default: 'DRAFT' },
    client_id: { type: 'INTEGER', references: 'clients(id)', onDelete: 'SET NULL' },
    chef_projet_id: { type: 'INTEGER', references: 'operateurs(id)', onDelete: 'SET NULL' },
    atelier: { type: 'VARCHAR', default: 'Atelier A' },
    date_echeance: { type: 'DATE', notNull: true },
    plan_numero: { type: 'VARCHAR' },
    notes: { type: 'TEXT' },
    cout_matieres: { type: 'DECIMAL(12,2)', default: 0 },
    cout_main_oeuvre: { type: 'DECIMAL(12,2)', default: 0 },
    cout_revient: { type: 'DECIMAL(12,2)', default: 0 },
    cancel_reason: { type: 'TEXT' },
    cancelled_by: { type: 'INTEGER', references: 'users(id)', onDelete: 'SET NULL' },
    cancelled_at: { type: 'TIMESTAMP' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 9. of_operations (section 7.10)
  // ==========================================
  pgm.createTable('of_operations', {
    id: { type: 'SERIAL', primaryKey: true },
    of_id: { type: 'INTEGER', notNull: true, references: 'ordres_fabrication(id)', onDelete: 'CASCADE' },
    operation_nom: { type: 'VARCHAR', notNull: true },
    machine_id: { type: 'INTEGER', references: 'machines(id)', onDelete: 'SET NULL' },
    ordre: { type: 'INTEGER' },
    statut: { type: 'VARCHAR', default: 'PENDING' },
    duree_prevue: { type: 'INTEGER' },
    duree_reelle: { type: 'INTEGER' },
    debut: { type: 'TIMESTAMP' },
    fin: { type: 'TIMESTAMP' },
    notes: { type: 'TEXT' }
  });

  // ==========================================
  // 10. op_operateurs (section 9.11)
  // ==========================================
  pgm.createTable('op_operateurs', {
    operation_id: { type: 'INTEGER', notNull: true, references: 'of_operations(id)', onDelete: 'CASCADE' },
    operateur_id: { type: 'INTEGER', notNull: true, references: 'operateurs(id)', onDelete: 'CASCADE' }
  }, {
    constraints: {
      primaryKey: ['operation_id', 'operateur_id']
    }
  });

  // ==========================================
  // 11. of_bom (section 9.12)
  // ==========================================
  pgm.createTable('of_bom', {
    of_id: { type: 'INTEGER', notNull: true, references: 'ordres_fabrication(id)', onDelete: 'CASCADE' },
    materiau_id: { type: 'INTEGER', notNull: true, references: 'materiaux(id)', onDelete: 'CASCADE' },
    quantite_requise: { type: 'DECIMAL(10,2)', notNull: true }
  }, {
    constraints: {
      primaryKey: ['of_id', 'materiau_id']
    }
  });

  // ==========================================
  // 12. bons_livraison (section 7.13)
  // ==========================================
  pgm.createTable('bons_livraison', {
    id: { type: 'SERIAL', primaryKey: true },
    numero: { type: 'VARCHAR', unique: true },
    of_id: { type: 'INTEGER', notNull: true, references: 'ordres_fabrication(id)' },
    statut: { type: 'VARCHAR', default: 'EMIS' },
    destinataire: { type: 'VARCHAR', default: 'SOFEM' },
    adresse: { type: 'VARCHAR', default: 'Route Sidi Salem 2.5KM, Sfax' },
    date_livraison: { type: 'DATE' },
    date_livraison_reelle: { type: 'DATE' },
    notes: { type: 'TEXT' },
    cancel_reason: { type: 'TEXT' },
    cancelled_by: { type: 'INTEGER', references: 'users(id)', onDelete: 'SET NULL' },
    cancelled_at: { type: 'TIMESTAMP' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 13. demandes_achat (section 7.14)
  // ==========================================
  pgm.createTable('demandes_achat', {
    id: { type: 'SERIAL', primaryKey: true },
    da_numero: { type: 'VARCHAR', unique: true },
    description: { type: 'TEXT', notNull: true },
    materiau_id: { type: 'INTEGER', references: 'materiaux(id)', onDelete: 'SET NULL' },
    of_id: { type: 'INTEGER', references: 'ordres_fabrication(id)', onDelete: 'SET NULL' },
    objet: { type: 'VARCHAR' },
    quantite: { type: 'DECIMAL(10,2)', notNull: true },
    unite: { type: 'VARCHAR', default: 'pcs' },
    urgence: { type: 'VARCHAR', default: 'NORMAL' },
    demandeur_id: { type: 'INTEGER', references: 'operateurs(id)', onDelete: 'SET NULL' },
    statut: { type: 'VARCHAR', default: 'PENDING' },
    valideur_id: { type: 'INTEGER', references: 'users(id)', onDelete: 'SET NULL' },
    notes: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 14. bons_commande (section 7.15)
  // ==========================================
  pgm.createTable('bons_commande', {
    id: { type: 'SERIAL', primaryKey: true },
    bc_numero: { type: 'VARCHAR', unique: true },
    fournisseur: { type: 'VARCHAR', notNull: true },
    da_id: { type: 'INTEGER', references: 'demandes_achat(id)', onDelete: 'SET NULL' },
    statut: { type: 'VARCHAR', default: 'DRAFT' },
    notes: { type: 'TEXT' },
    montant_ht: { type: 'DECIMAL(12,2)', default: 0 },
    montant_ttc: { type: 'DECIMAL(12,2)', default: 0 },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 15. bc_lignes (section 9.16)
  // ==========================================
  pgm.createTable('bc_lignes', {
    id: { type: 'SERIAL', primaryKey: true },
    bc_id: { type: 'INTEGER', notNull: true, references: 'bons_commande(id)', onDelete: 'CASCADE' },
    materiau_id: { type: 'INTEGER', references: 'materiaux(id)', onDelete: 'SET NULL' },
    description: { type: 'TEXT' },
    quantite: { type: 'DECIMAL(10,2)', notNull: true },
    unite: { type: 'VARCHAR', default: 'pcs' },
    prix_unitaire: { type: 'DECIMAL(10,2)', default: 0 }
  });

  // ==========================================
  // 16. bons_reception (section 7.17)
  // ==========================================
  pgm.createTable('bons_reception', {
    id: { type: 'SERIAL', primaryKey: true },
    br_numero: { type: 'VARCHAR', unique: true },
    bc_id: { type: 'INTEGER', notNull: true, references: 'bons_commande(id)' },
    statut: { type: 'VARCHAR', default: 'EN_ATTENTE' },
    date_reception: { type: 'DATE', notNull: true },
    notes: { type: 'TEXT' },
    quantite_recue: { type: 'DECIMAL(10,2)' },
    quantite_commandee: { type: 'DECIMAL(10,2)' },
    unite: { type: 'VARCHAR' },
    montant_total: { type: 'DECIMAL(12,2)' },
    fournisseur: { type: 'VARCHAR' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 17. br_lignes (section 9.18)
  // ==========================================
  pgm.createTable('br_lignes', {
    id: { type: 'SERIAL', primaryKey: true },
    bc_ligne_id: { type: 'INTEGER', notNull: true, references: 'bc_lignes(id)' },
    quantite_recue: { type: 'DECIMAL(10,2)', notNull: true },
    prix_unitaire: { type: 'DECIMAL(10,2)', default: 0 }
  });

  // ==========================================
  // 18. factures_achat (section 7.19)
  // ==========================================
  pgm.createTable('factures_achat', {
    id: { type: 'SERIAL', primaryKey: true },
    fa_numero: { type: 'VARCHAR', unique: true },
    bc_id: { type: 'INTEGER', references: 'bons_commande(id)', onDelete: 'SET NULL' },
    of_id: { type: 'INTEGER', references: 'ordres_fabrication(id)', onDelete: 'SET NULL' },
    fournisseur: { type: 'VARCHAR' },
    date_facture: { type: 'DATE', notNull: true },
    montant_ht: { type: 'DECIMAL(12,2)', default: 0 },
    notes: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 19. machines (section 7.20)
  // ==========================================
  pgm.createTable('machines', {
    id: { type: 'SERIAL', primaryKey: true },
    code: { type: 'VARCHAR', unique: true },
    nom: { type: 'VARCHAR', notNull: true },
    type: { type: 'VARCHAR' },
    atelier: { type: 'VARCHAR', default: 'Atelier A' },
    marque: { type: 'VARCHAR' },
    modele: { type: 'VARCHAR' },
    numero_serie: { type: 'VARCHAR' },
    statut: { type: 'VARCHAR', default: 'OPERATIONNELLE' },
    date_acquisition: { type: 'DATE' },
    notes: { type: 'TEXT' },
    actif: { type: 'BOOLEAN', default: true },
    deactivated_by: { type: 'INTEGER', references: 'users(id)', onDelete: 'SET NULL' },
    deactivated_at: { type: 'TIMESTAMP' },
    deactivation_reason: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 20. maintenance_orders (section 7.21)
  // ==========================================
  pgm.createTable('maintenance_orders', {
    id: { type: 'SERIAL', primaryKey: true },
    om_numero: { type: 'VARCHAR', unique: true },
    titre: { type: 'VARCHAR', notNull: true },
    machine_id: { type: 'INTEGER', notNull: true, references: 'machines(id)' },
    type_maintenance: { type: 'VARCHAR', default: 'CORRECTIVE' },
    priorite: { type: 'VARCHAR', default: 'NORMAL' },
    statut: { type: 'VARCHAR', default: 'PLANIFIE' },
    technicien_id: { type: 'INTEGER', references: 'operateurs(id)', onDelete: 'SET NULL' },
    date_planifiee: { type: 'DATE' },
    date_debut: { type: 'TIMESTAMP' },
    date_fin: { type: 'TIMESTAMP' },
    duree_estimee: { type: 'INTEGER', default: 0 },
    cout_estime: { type: 'DECIMAL(10,2)', default: 0 },
    cout_reel: { type: 'DECIMAL(10,2)', default: 0 },
    description: { type: 'TEXT' },
    notes: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 21. planning_slots (section 7.22)
  // ==========================================
  pgm.createTable('planning_slots', {
    id: { type: 'SERIAL', primaryKey: true },
    of_id: { type: 'INTEGER', notNull: true, references: 'ordres_fabrication(id)' },
    machine_id: { type: 'INTEGER', references: 'machines(id)', onDelete: 'SET NULL' },
    operateur_id: { type: 'INTEGER', references: 'operateurs(id)', onDelete: 'SET NULL' },
    date_debut: { type: 'TIMESTAMP', notNull: true },
    date_fin: { type: 'TIMESTAMP', notNull: true },
    statut: { type: 'VARCHAR', default: 'PLANIFIE' },
    notes: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 22. controle_qualite (section 7.23)
  // ==========================================
  pgm.createTable('controle_qualite', {
    id: { type: 'SERIAL', primaryKey: true },
    cq_numero: { type: 'VARCHAR', unique: true },
    of_id: { type: 'INTEGER', references: 'ordres_fabrication(id)', onDelete: 'SET NULL' },
    type_controle: { type: 'VARCHAR', default: 'FINAL' },
    operateur_id: { type: 'INTEGER', references: 'operateurs(id)', onDelete: 'SET NULL' },
    date_controle: { type: 'DATE', notNull: true },
    statut: { type: 'VARCHAR', default: 'EN_ATTENTE' },
    quantite_controlee: { type: 'DECIMAL(10,2)', default: 0 },
    quantite_conforme: { type: 'DECIMAL(10,2)', default: 0 },
    quantite_rebut: { type: 'DECIMAL(10,2)', default: 0 },
    notes: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 23. non_conformites (section 7.24)
  // ==========================================
  pgm.createTable('non_conformites', {
    id: { type: 'SERIAL', primaryKey: true },
    nc_numero: { type: 'VARCHAR', unique: true },
    cq_id: { type: 'INTEGER', references: 'controle_qualite(id)', onDelete: 'SET NULL' },
    of_id: { type: 'INTEGER', references: 'ordres_fabrication(id)', onDelete: 'SET NULL' },
    type_defaut: { type: 'VARCHAR', notNull: true },
    description: { type: 'TEXT' },
    gravite: { type: 'VARCHAR', default: 'MINEURE' },
    statut: { type: 'VARCHAR', default: 'OUVERTE' },
    action_corrective: { type: 'TEXT' },
    responsable_id: { type: 'INTEGER', references: 'operateurs(id)', onDelete: 'SET NULL' },
    date_cloture: { type: 'DATE' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 24. fournisseurs (section 7.25)
  // ==========================================
  pgm.createTable('fournisseurs', {
    id: { type: 'SERIAL', primaryKey: true },
    code: { type: 'VARCHAR', unique: true },
    nom: { type: 'VARCHAR', notNull: true },
    contact: { type: 'VARCHAR' },
    telephone: { type: 'VARCHAR' },
    email: { type: 'VARCHAR' },
    adresse: { type: 'TEXT' },
    ville: { type: 'VARCHAR' },
    pays: { type: 'VARCHAR', default: 'Tunisie' },
    matricule_fiscal: { type: 'VARCHAR' },
    statut: { type: 'VARCHAR', default: 'ACTIF' },
    notes: { type: 'TEXT' },
    actif: { type: 'BOOLEAN', default: true },
    deactivated_by: { type: 'INTEGER', references: 'users(id)', onDelete: 'SET NULL' },
    deactivated_at: { type: 'TIMESTAMP' },
    deactivation_reason: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 25. materiau_fournisseurs (section 9.29)
  // ==========================================
  pgm.createTable('materiau_fournisseurs', {
    fournisseur_id: { type: 'INTEGER', notNull: true, references: 'fournisseurs(id)', onDelete: 'CASCADE' },
    materiau_id: { type: 'INTEGER', notNull: true, references: 'materiaux(id)', onDelete: 'CASCADE' },
    prix_unitaire: { type: 'DECIMAL(10,2)' },
    delai_jours: { type: 'INTEGER' },
    principal: { type: 'BOOLEAN', default: false }
  }, {
    constraints: {
      primaryKey: ['fournisseur_id', 'materiau_id']
    }
  });

  // ==========================================
  // 26. operation_types (section 7.26)
  // ==========================================
  pgm.createTable('operation_types', {
    id: { type: 'SERIAL', primaryKey: true },
    nom: { type: 'VARCHAR', notNull: true, unique: true },
    description: { type: 'TEXT' },
    ordre: { type: 'INTEGER', default: 0 },
    actif: { type: 'BOOLEAN', default: true },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 27. settings (section 7.27)
  // ==========================================
  pgm.createTable('settings', {
    id: { type: 'SERIAL', primaryKey: true },
    groupe: { type: 'VARCHAR', notNull: true },
    cle: { type: 'VARCHAR', notNull: true, unique: true },
    valeur: { type: 'TEXT' },
    type: { type: 'VARCHAR', default: 'string' },
    description: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 28. mouvements_stock (section 9.8)
  // ==========================================
  pgm.createTable('mouvements_stock', {
    id: { type: 'BIGSERIAL', primaryKey: true },
    materiau_id: { type: 'INTEGER', notNull: true, references: 'materiaux(id)' },
    of_id: { type: 'INTEGER', references: 'ordres_fabrication(id)', onDelete: 'SET NULL' },
    type: { type: 'VARCHAR', notNull: true },
    quantite: { type: 'DECIMAL(10,2)', notNull: true },
    stock_avant: { type: 'DECIMAL(10,2)', notNull: true },
    stock_apres: { type: 'DECIMAL(10,2)', notNull: true },
    motif: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  });

  // ==========================================
  // 29. activity_log_v2 (section 7.28)
  // ==========================================
  pgm.createTable('activity_log_v2', {
    id: { type: 'BIGSERIAL', primaryKey: true },
    created_at: { type: 'TIMESTAMP', notNull: true, default: 'CURRENT_TIMESTAMP' },
    user_id: { type: 'INTEGER' },
    user_nom: { type: 'VARCHAR(100)' },
    action: { type: 'VARCHAR(50)', notNull: true },
    entity_type: { type: 'VARCHAR(50)', notNull: true },
    entity_id: { type: 'INTEGER' },
    entity_numero: { type: 'VARCHAR(50)' },
    old_value: { type: 'JSONB' },
    new_value: { type: 'JSONB' },
    reason: { type: 'VARCHAR(500)' },
    ip_address: { type: 'VARCHAR(45)' },
    session_token: { type: 'VARCHAR(20)' },
    detail: { type: 'TEXT' }
  });

  // ==========================================
  // CREATE ALL FOREIGN KEY INDEXES (section 9.30.1)
  // ==========================================
  
  // users
  pgm.createIndex('users', 'operateur_id');

  // ordres_fabrication
  pgm.createIndex('ordres_fabrication', 'produit_id');
  pgm.createIndex('ordres_fabrication', 'client_id');
  pgm.createIndex('ordres_fabrication', 'chef_projet_id');

  // of_operations
  pgm.createIndex('of_operations', 'of_id');
  pgm.createIndex('of_operations', 'machine_id');

  // op_operateurs
  pgm.createIndex('op_operateurs', 'operation_id');
  pgm.createIndex('op_operateurs', 'operateur_id');

  // of_bom
  pgm.createIndex('of_bom', 'of_id');
  pgm.createIndex('of_bom', 'materiau_id');

  // bom
  pgm.createIndex('bom', 'produit_id');
  pgm.createIndex('bom', 'materiau_id');

  // bons_livraison
  pgm.createIndex('bons_livraison', 'of_id');

  // demandes_achat
  pgm.createIndex('demandes_achat', 'materiau_id');
  pgm.createIndex('demandes_achat', 'of_id');
  pgm.createIndex('demandes_achat', 'demandeur_id');
  pgm.createIndex('demandes_achat', 'valideur_id');

  // bons_commande
  pgm.createIndex('bons_commande', 'da_id');

  // bc_lignes
  pgm.createIndex('bc_lignes', 'bc_id');
  pgm.createIndex('bc_lignes', 'materiau_id');

  // bons_reception
  pgm.createIndex('bons_reception', 'bc_id');

  // br_lignes
  pgm.createIndex('br_lignes', 'bc_ligne_id');

  // factures_achat
  pgm.createIndex('factures_achat', 'bc_id');
  pgm.createIndex('factures_achat', 'of_id');

  // maintenance_orders
  pgm.createIndex('maintenance_orders', 'machine_id');
  pgm.createIndex('maintenance_orders', 'technicien_id');

  // planning_slots
  pgm.createIndex('planning_slots', 'of_id');
  pgm.createIndex('planning_slots', 'machine_id');
  pgm.createIndex('planning_slots', 'operateur_id');

  // controle_qualite
  pgm.createIndex('controle_qualite', 'of_id');
  pgm.createIndex('controle_qualite', 'operateur_id');

  // non_conformites
  pgm.createIndex('non_conformites', 'cq_id');
  pgm.createIndex('non_conformites', 'of_id');
  pgm.createIndex('non_conformites', 'responsable_id');

  // mouvements_stock
  pgm.createIndex('mouvements_stock', 'materiau_id');
  pgm.createIndex('mouvements_stock', 'of_id');

  // deactivation tracking indexes
  pgm.createIndex('clients', 'deactivated_by');
  pgm.createIndex('materiaux', 'deactivated_by');
  pgm.createIndex('machines', 'deactivated_by');
  pgm.createIndex('fournisseurs', 'deactivated_by');

  // ordres_fabrication
  pgm.createIndex('ordres_fabrication', 'cancelled_by');

  // materiau_fournisseurs
  pgm.createIndex('materiau_fournisseurs', 'fournisseur_id');
  pgm.createIndex('materiau_fournisseurs', 'materiau_id');

  // ==========================================
  // COMPOSITE INDEXES (section 9.30.2)
  // ==========================================

  // OF filtering and sorting
  pgm.createIndex('ordres_fabrication', ['statut', 'date_echeance'], { name: 'idx_of_statut_date_echeance' });
  pgm.createIndex('ordres_fabrication', ['statut', 'priorite'], { name: 'idx_of_statut_priorite' });
  pgm.createIndex('ordres_fabrication', ['statut', 'created_at DESC'], { name: 'idx_of_statut_created' });

  // Operations by OF and order
  pgm.createIndex('of_operations', ['of_id', 'ordre'], { name: 'idx_of_operations_of_ordre' });

  // Stock alerts (partial index)
  pgm.createIndex('materiaux', ['stock_actuel', 'stock_minimum'], {
    name: 'idx_materiaux_stock_alert',
    where: 'stock_actuel < stock_minimum'
  });

  // Activity log queries
  pgm.createIndex('activity_log_v2', ['entity_type', 'entity_id'], { name: 'idx_activity_entity_type_id' });
  pgm.createIndex('activity_log_v2', ['user_id', 'created_at DESC'], { name: 'idx_activity_user_created' });
  pgm.createIndex('activity_log_v2', ['created_at DESC'], { name: 'idx_activity_created_desc' });

  // Movement history
  pgm.createIndex('mouvements_stock', ['materiau_id', 'created_at DESC'], { name: 'idx_mouvements_materiau_created' });

  // Planning queries
  pgm.createIndex('planning_slots', ['machine_id', 'date_debut', 'date_fin'], { name: 'idx_planning_machine_dates' });
  pgm.createIndex('planning_slots', ['of_id', 'date_debut'], { name: 'idx_planning_of_dates' });

  // Document number lookups
  pgm.createIndex('demandes_achat', ['statut', 'created_at DESC'], { name: 'idx_da_statut_created' });
  pgm.createIndex('bons_commande', ['statut', 'created_at DESC'], { name: 'idx_bc_statut_created' });

  // ==========================================
  // CHECK CONSTRAINTS (section 9.30.3)
  // ==========================================

  // OF status and priority
  pgm.addConstraint('ordres_fabrication', 'chk_of_statut',
    "CHECK (statut IN ('DRAFT','APPROVED','IN_PROGRESS','COMPLETED','CANCELLED'))"
  );
  pgm.addConstraint('ordres_fabrication', 'chk_of_priorite',
    "CHECK (priorite IN ('URGENT','HIGH','NORMAL','LOW'))"
  );

  // User roles
  pgm.addConstraint('users', 'chk_user_role',
    "CHECK (role IN ('ADMIN','MANAGER','OPERATOR'))"
  );

  // Operator roles
  pgm.addConstraint('operateurs', 'chk_operateur_role',
    "CHECK (role IN ('OPERATEUR','CHEF_ATELIER','RESPONSABLE','TECHNICIEN'))"
  );
  pgm.addConstraint('operateurs', 'chk_operateur_type_taux',
    "CHECK (type_taux IN ('HORAIRE','PIECE','BOTH'))"
  );

  // Machine status
  pgm.addConstraint('machines', 'chk_machine_statut',
    "CHECK (statut IN ('OPERATIONNELLE','EN_MAINTENANCE','EN_PANNE','ARRETEE'))"
  );

  // Operation status
  pgm.addConstraint('of_operations', 'chk_operation_statut',
    "CHECK (statut IN ('PENDING','IN_PROGRESS','COMPLETED'))"
  );

  // Stock movement types
  pgm.addConstraint('mouvements_stock', 'chk_mouvement_type',
    "CHECK (type IN ('ENTREE','SORTIE','ADJUST'))"
  );

  // BL status
  pgm.addConstraint('bons_livraison', 'chk_bl_statut',
    "CHECK (statut IN ('EMIS','LIVRE','CANCELLED'))"
  );

  // DA status and urgency
  pgm.addConstraint('demandes_achat', 'chk_da_statut',
    "CHECK (statut IN ('PENDING','APPROVED','REJECTED','ORDERED','RECEIVED','CANCELLED'))"
  );
  pgm.addConstraint('demandes_achat', 'chk_da_urgence',
    "CHECK (urgence IN ('NORMAL','URGENT'))"
  );

  // BC status
  pgm.addConstraint('bons_commande', 'chk_bc_statut',
    "CHECK (statut IN ('DRAFT','ENVOYE','RECU','ANNULE','RECU_PARTIEL'))"
  );

  // BR status
  pgm.addConstraint('bons_reception', 'chk_br_statut',
    "CHECK (statut IN ('EN_ATTENTE','COMPLET','PARTIEL','ANNULE'))"
  );

  // Maintenance type and status
  pgm.addConstraint('maintenance_orders', 'chk_maintenance_type',
    "CHECK (type_maintenance IN ('PREVENTIVE','CORRECTIVE','URGENCE'))"
  );
  pgm.addConstraint('maintenance_orders', 'chk_maintenance_statut',
    "CHECK (statut IN ('PLANIFIE','EN_COURS','TERMINE','ANNULE'))"
  );

  // Planning status
  pgm.addConstraint('planning_slots', 'chk_planning_statut',
    "CHECK (statut IN ('PLANIFIE','EN_COURS','TERMINE','ANNULE'))"
  );

  // Quality control
  pgm.addConstraint('controle_qualite', 'chk_cq_type',
    "CHECK (type_controle IN ('FINAL','INTERMEDIAIRE','RECEPTION'))"
  );
  pgm.addConstraint('controle_qualite', 'chk_cq_statut',
    "CHECK (statut IN ('EN_ATTENTE','CONFORME','NON_CONFORME','EN_COURS'))"
  );

  // Non-conformities
  pgm.addConstraint('non_conformites', 'chk_nc_gravite',
    "CHECK (gravite IN ('MINEURE','MAJEURE','CRITIQUE'))"
  );
  pgm.addConstraint('non_conformites', 'chk_nc_statut',
    "CHECK (statut IN ('OUVERTE','EN_COURS','CLOTUREE'))"
  );

  // Fournisseurs status
  pgm.addConstraint('fournisseurs', 'chk_fournisseur_statut',
    "CHECK (statut IN ('ACTIF','INACTIF','BLACKLISTE'))"
  );

  // Settings type
  pgm.addConstraint('settings', 'chk_setting_type',
    "CHECK (type IN ('string','boolean','number'))"
  );

  // ==========================================
  // UPDATED_AT TRIGGERS (section 9.30.4)
  // ==========================================
  const tablesWithUpdatedAt = [
    'clients',
    'operateurs',
    'produits',
    'materiaux',
    'ordres_fabrication',
    'bons_livraison',
    'demandes_achat',
    'bons_commande',
    'bons_reception',
    'factures_achat',
    'machines',
    'maintenance_orders',
    'planning_slots',
    'controle_qualite',
    'non_conformites',
    'fournisseurs',
    'operation_types',
    'settings'
  ];

  tablesWithUpdatedAt.forEach(tableName => {
    pgm.createTrigger(tableName, 'set_updated_at', {
      when: 'BEFORE',
      operation: 'UPDATE',
      function: 'update_updated_at_column',
      level: 'ROW'
    });
  });

  // ==========================================
  // ACTIVITY LOG INDEXES (section 7.28)
  // ==========================================
  pgm.createIndex('activity_log_v2', 'entity_type');
  pgm.createIndex('activity_log_v2', 'entity_id');
  pgm.createIndex('activity_log_v2', 'user_id');
  pgm.createIndex('activity_log_v2', 'action');
  pgm.createIndex('activity_log_v2', 'created_at');
  pgm.createIndex('activity_log_v2', 'entity_numero');

  // ==========================================
  // DOCUMENT SEQUENCES INDEX
  // ==========================================
  pgm.createIndex('document_sequences', 'updated_at');

  pgm.sql(`COMMENT ON CONSTRAINT chk_of_statut ON ordres_fabrication IS 'OF status must be one of: DRAFT, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED'`);
  pgm.sql(`COMMENT ON CONSTRAINT chk_user_role ON users IS 'User role must be one of: ADMIN, MANAGER, OPERATOR'`);
  pgm.sql(`COMMENT ON CONSTRAINT chk_operateur_role ON operateurs IS 'Operator role must be one of: OPERATEUR, CHEF_ATELIER, RESPONSABLE, TECHNICIEN'`);
}
