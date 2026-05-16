const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

function run(query, params = []) {
  // Convertir les ? de SQLite en $1,$2... pour PostgreSQL
  let i = 0;
  const pgQuery = query.replace(/\?/g, () => `$${++i}`);
  // Convertir AUTOINCREMENT → SERIAL (ignoré ici, géré dans initDb)
  return pool.query(pgQuery, params);
}

async function get(query, params = []) {
  let i = 0;
  const pgQuery = query.replace(/\?/g, () => `$${++i}`);
  const result = await pool.query(pgQuery, params);
  return result.rows[0] || null;
}

async function all(query, params = []) {
  let i = 0;
  const pgQuery = query.replace(/\?/g, () => `$${++i}`);
  const result = await pool.query(pgQuery, params);
  return result.rows;
}

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','student','professor')),
    department TEXT,
    promotion TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sector TEXT,
    location TEXT,
    description TEXT,
    contact_email TEXT,
    website TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS internships (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    title TEXT NOT NULL,
    description TEXT,
    duration TEXT,
    location TEXT,
    paid TEXT,
    status TEXT DEFAULT 'Ouvert',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    student_name TEXT NOT NULL,
    year TEXT,
    specialty TEXT,
    summary TEXT,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    internship_id INTEGER NOT NULL REFERENCES internships(id),
    status TEXT DEFAULT 'En attente',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`);

  // Créer uniquement le compte admin si absent
  const admin = await get('SELECT * FROM users WHERE email = $1', ['admin@isetdjerba.tn']);
  if (!admin) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    await pool.query(
      'INSERT INTO users (full_name, email, password, role, department, promotion) VALUES ($1,$2,$3,$4,$5,$6)',
      ['Administrateur ISET Djerba', 'admin@isetdjerba.tn', adminPassword, 'admin', 'Administration', '2026']
    );
  }

  const companyCount = await get('SELECT COUNT(*) as count FROM companies');
  if (parseInt(companyCount.count) === 0) {
    const companies = [
      ['Djerba Tech Solutions', 'Développement Web', 'Houmt Souk', 'Entreprise spécialisée dans les applications web et mobiles.', 'contact@djerbatech.tn', 'https://djerbatech.tn'],
      ['Smart Tourism Lab', 'Tourisme & Data', 'Midoun', 'Solutions digitales pour le tourisme intelligent à Djerba.', 'jobs@smarttourism.tn', 'https://smarttourism.tn'],
      ['Tunisia Cloud Services', 'Cloud & DevOps', 'à distance', 'Accompagnement cloud, intégration continue et sécurité.', 'hr@tcs.tn', 'https://tunisiacloud.tn']
    ];
    for (const company of companies) {
      await pool.query('INSERT INTO companies (name, sector, location, description, contact_email, website) VALUES ($1,$2,$3,$4,$5,$6)', company);
    }

    const internships = [
      [1, 'Stage Développeur Full Stack', "Création d'une plateforme de gestion interne en Node.js et Vue.", '2 à 3 mois', 'Houmt Souk', 'Oui', 'Ouvert'],
      [2, 'Stage UX/UI & Front-end', "Conception d'interfaces modernes pour une application touristique.", '1 à 2 mois', 'Midoun', 'Selon profil', 'Ouvert'],
      [3, 'Stage DevOps Junior', 'Mise en place de pipelines CI/CD et supervision des services.', '3 mois', 'Hybride', 'Oui', 'Ouvert'],
      [1, 'Stage Base de données', 'Optimisation de schémas SQL et génération de tableaux de bord.', '2 mois', 'Houmt Souk', 'Non', 'Ouvert']
    ];
    for (const internship of internships) {
      await pool.query('INSERT INTO internships (company_id, title, description, duration, location, paid, status) VALUES ($1,$2,$3,$4,$5,$6,$7)', internship);
    }
  }

  const reportCount = await get('SELECT COUNT(*) as count FROM reports');
  if (parseInt(reportCount.count) === 0) {
    const reports = [
      ['Développement d\'une application de réservation touristique', 'Sarra Gharbi', '2024', 'Informatique', 'Rapport sur une application de réservation avec React et API REST.', '#'],
      ['Automatisation du déploiement cloud', 'Youssef Charfi', '2023', 'Réseaux', 'Projet d\'automatisation CI/CD avec conteneurs et surveillance.', '#'],
      ['Refonte UX d\'un portail académique', 'Mouna Jaziri', '2022', 'Multimédia', 'Analyse ergonomique et prototype haute fidélité pour portail étudiant.', '#']
    ];
    for (const report of reports) {
      await pool.query('INSERT INTO reports (title, student_name, year, specialty, summary, file_url) VALUES ($1,$2,$3,$4,$5,$6)', report);
    }
  }
}

module.exports = { pool, run, get, all, initDb };
