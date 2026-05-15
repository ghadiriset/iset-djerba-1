const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'data', 'platform.db');
const db = new sqlite3.Database(dbPath);

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','student','professor')),
    department TEXT,
    promotion TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sector TEXT,
    location TEXT,
    description TEXT,
    contact_email TEXT,
    website TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS internships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    duration TEXT,
    location TEXT,
    paid TEXT,
    status TEXT DEFAULT 'Ouvert',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    student_name TEXT NOT NULL,
    year TEXT,
    specialty TEXT,
    summary TEXT,
    file_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    internship_id INTEGER NOT NULL,
    status TEXT DEFAULT 'En attente',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES users(id),
    FOREIGN KEY(internship_id) REFERENCES internships(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
  )`);

  const admin = await get('SELECT * FROM users WHERE email = ?', ['admin@isetdjerba.tn']);
  if (!admin) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const studentPassword = await bcrypt.hash('student123', 10);
    const profPassword = await bcrypt.hash('prof123', 10);

    await run(`INSERT INTO users (full_name, email, password, role, department, promotion) VALUES
      (?, ?, ?, 'admin', ?, ?),
      (?, ?, ?, 'student', ?, ?),
      (?, ?, ?, 'student', ?, ?),
      (?, ?, ?, 'professor', ?, ?),
      (?, ?, ?, 'professor', ?, ?)`, [
      'Administrateur ISET Djerba', 'admin@isetdjerba.tn', adminPassword, 'Administration', '2026',
      'Aymen Ben Salah', 'student@isetdjerba.tn', studentPassword, 'Informatique', '2A',
      'Meriem Trabelsi', 'etudiante@isetdjerba.tn', studentPassword, 'Réseaux', '3A',
      'Mme Amel Kchaou', 'prof@isetdjerba.tn', profPassword, 'Informatique', 'Encadrante',
      'M. Sami Mnif', 'prof2@isetdjerba.tn', profPassword, 'Multimédia', 'Encadrant'
    ]);
  }

  const companyCount = await get('SELECT COUNT(*) as count FROM companies');
  if (!companyCount.count) {
    const companies = [
      ['Djerba Tech Solutions', 'Développement Web', 'Houmt Souk', 'Entreprise spécialisée dans les applications web et mobiles.', 'contact@djerbatech.tn', 'https://djerbatech.tn'],
      ['Smart Tourism Lab', 'Tourisme & Data', 'Midoun', 'Solutions digitales pour le tourisme intelligent à Djerba.', 'jobs@smarttourism.tn', 'https://smarttourism.tn'],
      ['Tunisia Cloud Services', 'Cloud & DevOps', 'à distance', 'Accompagnement cloud, intégration continue et sécurité.', 'hr@tcs.tn', 'https://tunisiacloud.tn']
    ];
    for (const company of companies) {
      await run('INSERT INTO companies (name, sector, location, description, contact_email, website) VALUES (?, ?, ?, ?, ?, ?)', company);
    }

    const internships = [
      [1, 'Stage Développeur Full Stack', "Création d'une plateforme de gestion interne en Node.js et Vue.", '2 à 3 mois', 'Houmt Souk', 'Oui', 'Ouvert'],
      [2, 'Stage UX/UI & Front-end', "Conception d'interfaces modernes pour une application touristique.", '1 à 2 mois', 'Midoun', 'Selon profil', 'Ouvert'],
      [3, 'Stage DevOps Junior', 'Mise en place de pipelines CI/CD et supervision des services.', '3 mois', 'Hybride', 'Oui', 'Ouvert'],
      [1, 'Stage Base de données', 'Optimisation de schémas SQL et génération de tableaux de bord.', '2 mois', 'Houmt Souk', 'Non', 'Ouvert']
    ];
    for (const internship of internships) {
      await run('INSERT INTO internships (company_id, title, description, duration, location, paid, status) VALUES (?, ?, ?, ?, ?, ?, ?)', internship);
    }
  }

  const reportCount = await get('SELECT COUNT(*) as count FROM reports');
  if (!reportCount.count) {
    const reports = [
      ['Développement d\'une application de réservation touristique', 'Sarra Gharbi', '2024', 'Informatique', 'Rapport sur une application de réservation avec React et API REST.', '#'],
      ['Automatisation du déploiement cloud', 'Youssef Charfi', '2023', 'Réseaux', 'Projet d\'automatisation CI/CD avec conteneurs et surveillance.', '#'],
      ['Refonte UX d\'un portail académique', 'Mouna Jaziri', '2022', 'Multimédia', 'Analyse ergonomique et prototype haute fidélité pour portail étudiant.', '#']
    ];
    for (const report of reports) {
      await run('INSERT INTO reports (title, student_name, year, specialty, summary, file_url) VALUES (?, ?, ?, ?, ?, ?)', report);
    }
  }
}

module.exports = { db, run, get, all, initDb };
