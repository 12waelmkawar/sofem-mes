import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sofem_mes',
  ssl: process.env.DATABASE_URL?.includes('neon') || process.env.DATABASE_URL?.includes('ssl')
    ? { rejectUnauthorized: false }
    : undefined,
});

async function seed() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('🌱 Starting seed...');

    // ==========================================
    // 1. DOCUMENT SEQUENCES (pre-seed some prefixes)
    // ==========================================
    console.log('📄 Seeding document_sequences...');
    const prefixes = ['OF', 'DA', 'BC', 'BR', 'BL', 'CLT', 'FOURN', 'MCH', 'SOFEM', 'CQ', 'NC', 'OM'];
    const currentYear = new Date().getFullYear();
    
    for (const prefix of prefixes) {
      await client.query(
        `INSERT INTO document_sequences (prefix, year, last_seq) 
         VALUES ($1, $2, 0) 
         ON CONFLICT (prefix, year) DO NOTHING`,
        [prefix, currentYear]
      );
    }

    // ==========================================
    // 2. OPERATION TYPES (section 7.26)
    // ==========================================
    console.log('⚙️ Seeding operation_types...');
    const operationTypes = [
      { nom: 'Découpe Laser', description: 'Découpe de tôles au laser', ordre: 1 },
      { nom: 'Pliage', description: 'Pliage CNC', ordre: 2 },
      { nom: 'Soudure MIG', description: 'Soudure MIG/MAG', ordre: 3 },
      { nom: 'Soudure TIG', description: 'Soudure TIG', ordre: 4 },
      { nom: 'Perçage', description: 'Perçage conventionnel ou CNC', ordre: 5 },
      { nom: 'Finition', description: 'Meulage, ponçage, peinture', ordre: 6 },
    ];

    const opTypeIds: Record<string, number> = {};
    for (const op of operationTypes) {
      const res = await client.query(
        `INSERT INTO operation_types (nom, description, ordre) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (nom) DO NOTHING 
         RETURNING id`,
        [op.nom, op.description, op.ordre]
      );
      if (res.rows.length > 0) {
        opTypeIds[op.nom] = res.rows[0].id;
      } else {
        const existing = await client.query('SELECT id FROM operation_types WHERE nom = $1', [op.nom]);
        opTypeIds[op.nom] = existing.rows[0].id;
      }
    }

    // ==========================================
    // 3. OPERATEURS (section 7.4)
    // ==========================================
    console.log('👷 Seeding operateurs...');
    const operateurs = [
      { nom: 'Ben Ali', prenom: 'Mohamed', specialite: 'Soudure TIG', role: 'CHEF_ATELIER' },
      { nom: 'Trabelsi', prenom: 'Karim', specialite: 'Découpe Laser', role: 'OPERATEUR' },
      { nom: 'Hamdi', prenom: 'Ahmed', specialite: 'Pliage CNC', role: 'OPERATEUR' },
    ];

    const operateurIds: number[] = [];
    for (const op of operateurs) {
      const existing = await client.query(
        `SELECT id FROM operateurs WHERE nom = $1 AND prenom = $2 LIMIT 1`,
        [op.nom, op.prenom]
      );

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE operateurs SET specialite = $1, role = $2 WHERE id = $3`,
          [op.specialite, op.role, existing.rows[0].id]
        );
        operateurIds.push(existing.rows[0].id);
      } else {
        const res = await client.query(
          `INSERT INTO operateurs (nom, prenom, specialite, role) 
           VALUES ($1, $2, $3, $4) 
           RETURNING id`,
          [op.nom, op.prenom, op.specialite, op.role]
        );
        operateurIds.push(res.rows[0].id);
      }
    }

    // ==========================================
    // 4. USERS (section 7.2) - PIN hashed with bcrypt
    // ==========================================
    console.log('🔐 Seeding users...');
    
    // Define unique PINs for each user
    const pins = {
      admin: '9876',
      manager: '5432',
      operators: ['1111', '2222', '3333'],
    };

    // Hash all PINs
    const adminPinHash = await bcrypt.hash(pins.admin, 10);
    const managerPinHash = await bcrypt.hash(pins.manager, 10);
    const operatorPinHashes = await Promise.all(pins.operators.map(pin => bcrypt.hash(pin, 10)));
    
    // Admin user
    const adminUpdate = await client.query(
      `UPDATE users SET pin_hash = $1, actif = true
       WHERE nom = $2 AND prenom = $3 AND role = $4`,
      [adminPinHash, 'Admin', 'System', 'ADMIN']
    );
    if (adminUpdate.rowCount === 0) {
      await client.query(
        `INSERT INTO users (nom, prenom, role, pin_hash)
         VALUES ($1, $2, $3, $4)`,
        ['Admin', 'System', 'ADMIN', adminPinHash]
      );
    }
    console.log(`   ✅ Admin created (PIN: ${pins.admin})`);

    // Manager user
    const managerUpdate = await client.query(
      `UPDATE users SET pin_hash = $1, actif = true
       WHERE nom = $2 AND prenom = $3 AND role = $4`,
      [managerPinHash, 'Manager', 'Production', 'MANAGER']
    );
    if (managerUpdate.rowCount === 0) {
      await client.query(
        `INSERT INTO users (nom, prenom, role, pin_hash)
         VALUES ($1, $2, $3, $4)`,
        ['Manager', 'Production', 'MANAGER', managerPinHash]
      );
    }
    console.log(`   ✅ Manager created (PIN: ${pins.manager})`);

    // Operator users (linked to operateurs)
    const operatorNames = [
      { nom: 'Ben Ali', prenom: 'Mohamed' },
      { nom: 'Trabelsi', prenom: 'Karim' },
      { nom: 'Hamdi', prenom: 'Ahmed' },
    ];

    for (let i = 0; i < operatorNames.length; i++) {
      const opUser = operatorNames[i];
      const opUserUpdate = await client.query(
        `UPDATE users SET pin_hash = $1, operateur_id = $2, actif = true
         WHERE nom = $3 AND prenom = $4 AND role = $5`,
        [operatorPinHashes[i], operateurIds[i], opUser.nom, opUser.prenom, 'OPERATOR']
      );
      if (opUserUpdate.rowCount === 0) {
        await client.query(
          `INSERT INTO users (nom, prenom, role, pin_hash, operateur_id) 
           VALUES ($1, $2, $3, $4, $5)`,
          [opUser.nom, opUser.prenom, 'OPERATOR', operatorPinHashes[i], operateurIds[i]]
        );
      }
      console.log(`   ✅ Operator ${operatorNames[i].prenom} created (PIN: ${pins.operators[i]})`);
    }

    // ==========================================
    // 5. CLIENTS (section 7.3)
    // ==========================================
    console.log('🏢 Seeding clients...');
    const clients = [
      { nom: 'STE INDUSTRIELLE DU SAHEL', matricule_fiscal: '1234567/A/M/000', ville: 'Sfax' },
      { nom: 'TUNISIE CABLAGE', matricule_fiscal: '2345678/B/M/000', ville: 'Sfax' },
      { nom: 'PRYSMIAN CABLES TUNISIE', matricule_fiscal: '3456789/C/M/000', ville: 'Tunis' },
      { nom: 'SOTUVER', matricule_fiscal: '4567890/D/M/000', ville: 'Sousse' },
      { nom: 'MECANIQUE MODERNE', matricule_fiscal: '5678901/E/M/000', ville: 'Sfax' },
    ];

    const clientIds: number[] = [];
    for (const cl of clients) {
      // Generate CLT code manually since finalizeNumber needs sequences
      const clientCode = `CLT-${currentYear}-${String(clientIds.length + 1).padStart(4, '0')}`;
      const codeRes = await client.query(
        `INSERT INTO clients (code, nom, matricule_fiscal, ville) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (code) DO UPDATE
         SET nom = EXCLUDED.nom,
             matricule_fiscal = EXCLUDED.matricule_fiscal,
             ville = EXCLUDED.ville
         RETURNING id, code`,
        [clientCode, cl.nom, cl.matricule_fiscal, cl.ville]
      );
      clientIds.push(codeRes.rows[0].id);
      
      // Update sequence
      await client.query(
        `UPDATE document_sequences SET last_seq = $1 WHERE prefix = 'CLT' AND year = $2`,
        [clientIds.length, currentYear]
      );
    }

    // ==========================================
    // 6. MATERIAUX (section 9.7)
    // ==========================================
    console.log('📦 Seeding materiaux...');
    const materiaux = [
      { nom: 'Tôle Acier S235 2mm', unite: 'm²', stock: 150, min: 50, prix: 12.5 },
      { nom: 'Tôle Acier S235 3mm', unite: 'm²', stock: 80, min: 30, prix: 15.0 },
      { nom: 'Tôle Inox 304 2mm', unite: 'm²', stock: 40, min: 20, prix: 45.0 },
      { nom: 'Tube carré 40x40x2', unite: 'ml', stock: 200, min: 100, prix: 8.5 },
      { nom: 'Tube rond Ø50x2', unite: 'ml', stock: 120, min: 50, prix: 10.0 },
      { nom: 'Cornière 50x50x5', unite: 'ml', stock: 180, min: 80, prix: 9.0 },
      { nom: 'Plat 40x4', unite: 'ml', stock: 250, min: 100, prix: 6.0 },
      { nom: 'Fil soudure MIG 0.8mm', unite: 'kg', stock: 35, min: 20, prix: 18.0 },
      { nom: 'Fil soudure TIG 1.6mm', unite: 'kg', stock: 15, min: 10, prix: 35.0 },
      { nom: 'Peinture epoxy noire', unite: 'L', stock: 25, min: 15, prix: 22.0 },
    ];

    const materiauIds: number[] = [];
    for (const mat of materiaux) {
      const materiauCode = `MAT-${currentYear}-${String(materiauIds.length + 1).padStart(4, '0')}`;
      const res = await client.query(
        `INSERT INTO materiaux (code, nom, unite, stock_actuel, stock_minimum, prix_unitaire) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         ON CONFLICT (code) DO UPDATE
         SET nom = EXCLUDED.nom,
             unite = EXCLUDED.unite,
             stock_actuel = EXCLUDED.stock_actuel,
             stock_minimum = EXCLUDED.stock_minimum,
             prix_unitaire = EXCLUDED.prix_unitaire
         RETURNING id`,
        [materiauCode, mat.nom, mat.unite, mat.stock, mat.min, mat.prix]
      );
      materiauIds.push(res.rows[0].id);
    }

    // ==========================================
    // 7. PRODUITS (section 7.5)
    // ==========================================
    console.log('🔧 Seeding produits...');
    const produits = [
      { nom: 'Support métallique SM-01', description: 'Support de fixation en acier S235', unite: 'pcs', prix: 85.0 },
      { nom: 'Caisson de protection CP-02', description: 'Caisson de protection en inox 304', unite: 'pcs', prix: 250.0 },
      { nom: 'Châssis industriel CH-03', description: 'Châssis pour équipements industriels', unite: 'pcs', prix: 420.0 },
    ];

    const produitIds: number[] = [];
    for (const prod of produits) {
      const produitCode = `SOFEM-${currentYear}-${String(produitIds.length + 1).padStart(4, '0')}`;
      const res = await client.query(
        `INSERT INTO produits (code, nom, description, unite, prix_vente_ht) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (code) DO UPDATE
         SET nom = EXCLUDED.nom,
             description = EXCLUDED.description,
             unite = EXCLUDED.unite,
             prix_vente_ht = EXCLUDED.prix_vente_ht
         RETURNING id`,
        [produitCode, prod.nom, prod.description, prod.unite, prod.prix]
      );
      produitIds.push(res.rows[0].id);
    }

    // ==========================================
    // 8. BOM (section 9.6) - Product Bill of Materials
    // ==========================================
    console.log('📋 Seeding BOM...');
    
    // BOM for Produit 1: Support métallique SM-01
    const bom1 = [
      { produitId: produitIds[0], materiauId: materiauIds[0], qte: 0.5 },  // Tôle 2mm
      { produitId: produitIds[0], materiauId: materiauIds[3], qte: 1.2 },  // Tube carré
      { produitId: produitIds[0], materiauId: materiauIds[7], qte: 0.3 },  // Fil MIG
    ];

    // BOM for Produit 2: Caisson de protection CP-02
    const bom2 = [
      { produitId: produitIds[1], materiauId: materiauIds[2], qte: 1.8 },  // Tôle Inox
      { produitId: produitIds[1], materiauId: materiauIds[5], qte: 3.0 },  // Cornière
      { produitId: produitIds[1], materiauId: materiauIds[8], qte: 0.5 },  // Fil TIG
      { produitId: produitIds[1], materiauId: materiauIds[9], qte: 0.4 },  // Peinture
    ];

    // BOM for Produit 3: Châssis industriel CH-03
    const bom3 = [
      { produitId: produitIds[2], materiauId: materiauIds[1], qte: 2.0 },  // Tôle 3mm
      { produitId: produitIds[2], materiauId: materiauIds[4], qte: 4.5 },  // Tube rond
      { produitId: produitIds[2], materiauId: materiauIds[6], qte: 2.0 },  // Plat
      { produitId: produitIds[2], materiauId: materiauIds[7], qte: 0.8 },  // Fil MIG
    ];

    for (const bom of [...bom1, ...bom2, ...bom3]) {
      await client.query(
        `INSERT INTO bom (produit_id, materiau_id, quantite_par_unite) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (produit_id, materiau_id) DO NOTHING`,
        [bom.produitId, bom.materiauId, bom.qte]
      );
    }

    // ==========================================
    // 9. MACHINES (section 7.20)
    // ==========================================
    console.log('🏭 Seeding machines...');
    const machines = [
      { nom: 'Laser Trumpf TruLaser 3030', type: 'Découpe Laser', statut: 'OPERATIONNELLE' },
      { nom: 'Presse plieuse Amada HG-1003', type: 'Pliage', statut: 'OPERATIONNELLE' },
      { nom: 'Poste Soudure MIG Lincoln', type: 'Soudure', statut: 'OPERATIONNELLE' },
      { nom: 'Poste Soudure TIG EWM', type: 'Soudure', statut: 'OPERATIONNELLE' },
    ];

    for (let i = 0; i < machines.length; i++) {
      const mach = machines[i];
      const machineCode = `MCH-${currentYear}-${String(i + 1).padStart(4, '0')}`;
      await client.query(
        `INSERT INTO machines (code, nom, type, statut) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE
         SET nom = EXCLUDED.nom,
             type = EXCLUDED.type,
             statut = EXCLUDED.statut`,
        [machineCode, mach.nom, mach.type, mach.statut]
      );
    }

    // ==========================================
    // 10. FOURNISSEURS (section 7.25)
    // ==========================================
    console.log('🚚 Seeding fournisseurs...');
    await client.query(
      `INSERT INTO fournisseurs (code, nom, contact, telephone, email, ville) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT DO NOTHING`,
      [`FOURN-${currentYear}-0001`, 'Métallurgie Tunisie', 'Ahmed Fournisseur', '+216 74 123 456', 'contact@metallurgie-tunisie.tn', 'Sfax']
    );

    // ==========================================
    // 11. SETTINGS (section 7.27)
    // ==========================================
    console.log('⚙️ Seeding default settings...');
    const settings = [
      // Societe
      { groupe: 'societe', cle: 'company_name', valeur: 'SOFEM', type: 'string', description: 'Nom de l\'entreprise' },
      { groupe: 'societe', cle: 'company_address', valeur: 'Route Sidi Salem 2.5KM, Sfax', type: 'string', description: 'Adresse de l\'entreprise' },
      { groupe: 'societe', cle: 'company_phone', valeur: '+216 74 123 456', type: 'string', description: 'Téléphone de l\'entreprise' },
      { groupe: 'societe', cle: 'company_email', valeur: 'contact@sofem.com.tn', type: 'string', description: 'Email de l\'entreprise' },
      { groupe: 'societe', cle: 'company_mf', valeur: '1234567/A/M/000', type: 'string', description: 'Matricule fiscal' },
      
      // Finance
      { groupe: 'finance', cle: 'tva_rate', valeur: '19', type: 'number', description: 'Taux TVA par défaut (%)' },
      { groupe: 'finance', cle: 'currency', valeur: 'TND', type: 'string', description: 'Devise (TND = Dinar tunisien)' },
      
      // Workflow
      { groupe: 'workflow', cle: 'bl_auto_creation', valeur: 'true', type: 'boolean', description: 'Création automatique des BL lors de la création d\'OF' },
      { groupe: 'workflow', cle: 'cq_auto_creation', valeur: 'true', type: 'boolean', description: 'Création automatique du contrôle qualité quand OF terminé' },
      { groupe: 'workflow', cle: 'da_auto_approve_seuil', valeur: '500', type: 'number', description: 'Seuil d\'approbation automatique des DA (en DT)' },
      { groupe: 'workflow', cle: 'stock_deduction_auto', valeur: 'true', type: 'boolean', description: 'Déduction automatique du stock' },
      
      // Alertes
      { groupe: 'alertes', cle: 'stock_alert_threshold', valeur: '50', type: 'number', description: 'Seuil d\'alerte stock (%)' },
      { groupe: 'alertes', cle: 'echeance_alert_days', valeur: '3', type: 'number', description: 'Jours avant échéance pour alerte' },
      
      // PDF
      { groupe: 'pdf', cle: 'pdf_footer_text', valeur: 'SOFEM MES - SMARTMOVE 2025', type: 'string', description: 'Texte du pied de page PDF' },
      
      // Acces
      { groupe: 'acces', cle: 'pin_min_length', valeur: '4', type: 'number', description: 'Longueur minimale du PIN' },
      { groupe: 'acces', cle: 'session_timeout_minutes', valeur: '480', type: 'number', description: 'Timeout de session (minutes)' },
    ];

    for (const setting of settings) {
      await client.query(
        `INSERT INTO settings (groupe, cle, valeur, type, description) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (cle) DO NOTHING`,
        [setting.groupe, setting.cle, setting.valeur, setting.type, setting.description]
      );
    }

    // ==========================================
    // COMMIT
    // ==========================================
    await client.query('COMMIT');
    console.log('✅ Seed completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   - ${prefixes.length} document sequences`);
    console.log(`   - ${operationTypes.length} operation types`);
    console.log(`   - ${operateurs.length} operateurs`);
    console.log(`   - 5 users (1 admin, 1 manager, 3 operators)`);
    console.log(`   - ${clients.length} clients`);
    console.log(`   - ${materiaux.length} materiaux`);
    console.log(`   - ${produits.length} produits`);
    console.log(`   - ${bom1.length + bom2.length + bom3.length} BOM lines`);
    console.log(`   - ${machines.length} machines`);
    console.log(`   - 1 fournisseur`);
    console.log(`   - ${settings.length} settings`);
    console.log('');
    console.log('🔑 PIN Codes:');
    console.log(`   - Admin: ${pins.admin}`);
    console.log(`   - Manager: ${pins.manager}`);
    for (let i = 0; i < operatorNames.length; i++) {
      console.log(`   - ${operatorNames[i].prenom}: ${pins.operators[i]}`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
