// Script pour importer les données Excel dans la base de données
// Usage: node import_excel.js
const XLSX = require('xlsx');
const path = require('path');
const { run, get, initDb } = require('./db');

async function importFromExcel(filePath) {
  await initDb();
  
  const workbook = XLSX.readFile(filePath);
  let totalCompanies = 0;
  let totalInternships = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: ['stage', 'classe', 'entreprise'] });

    for (const row of rows.slice(1)) { // Skip header
      if (!row.entreprise || !row.stage) continue;
      const name = String(row.entreprise).trim();
      const stageType = String(row.stage).trim();
      const classe = String(row.classe || '').trim();

      // Insert company if not exists
      const existing = await get('SELECT id FROM companies WHERE name = ?', [name]);
      let companyId;
      if (!existing) {
        const result = await run(
          'INSERT INTO companies (name, sector, location, description) VALUES (?, ?, ?, ?)',
          [name, 'Divers', 'Tunisie', 'Entreprise partenaire ISET Djerba']
        );
        companyId = result.lastID;
        totalCompanies++;
      } else {
        companyId = existing.id;
      }

      // Insert internship
      await run(
        'INSERT INTO internships (company_id, title, description, duration, location, paid, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [companyId, `${stageType} - ${classe} (${sheetName})`, `Stage ${stageType} pour la classe ${classe}`, '2-3 mois', 'Tunisie', 'Non précisé', 'Archivé']
      );
      totalInternships++;
    }
  }

  console.log(`✅ Import terminé: ${totalCompanies} entreprises, ${totalInternships} stages ajoutés.`);
  process.exit(0);
}

const filePath = process.argv[2] || './Stage_pour_PFE.xlsx';
importFromExcel(filePath).catch(err => { console.error(err); process.exit(1); });
