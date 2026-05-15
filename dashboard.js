const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { all, get, run } = require('../db');
const { ensureAuth } = require('../middleware');
const router = express.Router();

// Upload PDF pour rapports utilisateurs
const reportsDir = path.join(__dirname, '..', 'public', 'uploads', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reportsDir),
  filename: (req, file, cb) => {
    const base = (path.parse(file.originalname).name || 'rapport')
      .replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    cb(null, `${Date.now()}-${base || 'rapport'}.pdf`);
  }
});
const uploadReport = multer({
  storage: reportStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf')
      return cb(null, true);
    cb(new Error('Seuls les fichiers PDF sont autorisés.'));
  }
});

router.get('/dashboard', ensureAuth, async (req, res) => {
  const user = req.session.user;

  if (user.role === 'admin') {
    const stats = {
      students: await get("SELECT COUNT(*) AS total FROM users WHERE role='student'"),
      professors: await get("SELECT COUNT(*) AS total FROM users WHERE role='professor'"),
      companies: await get("SELECT COUNT(*) AS total FROM companies"),
      internships: await get("SELECT COUNT(*) AS total FROM internships")
    };
    const users = await all('SELECT id, full_name, email, role, department, promotion FROM users ORDER BY id DESC');
    const companies = await all('SELECT * FROM companies ORDER BY id DESC');
    const reports = await all('SELECT * FROM reports ORDER BY year DESC, id DESC');
    return res.render('admin/dashboard', { title: 'Dashboard admin', stats, users, companies, reports });
  }

  if (user.role === 'student') {
    const internships = await all(`SELECT internships.*, companies.name AS company_name
      FROM internships JOIN companies ON companies.id = internships.company_id ORDER BY internships.id DESC LIMIT 6`);
    const applications = await all(`SELECT applications.*, internships.title, companies.name AS company_name
      FROM applications
      JOIN internships ON internships.id = applications.internship_id
      JOIN companies ON companies.id = internships.company_id
      WHERE applications.student_id = ?
      ORDER BY applications.id DESC`, [user.id]);
    const professors = await all("SELECT id, full_name, email, department FROM users WHERE role='professor'");
    return res.render('student/dashboard', { title: 'Dashboard étudiant', internships, applications, professors });
  }

  const students = await all("SELECT id, full_name, email, department, promotion FROM users WHERE role='student' ORDER BY id DESC");
  const reports = await all('SELECT * FROM reports ORDER BY year DESC');
  return res.render('professor/dashboard', { title: 'Dashboard professeur', students, reports });
});

router.post('/postuler/:id', ensureAuth, async (req, res) => {
  if (req.session.user.role !== 'student') return res.redirect(303, '/dashboard');
  await run('INSERT INTO applications (student_id, internship_id, status) VALUES (?, ?, ?)', [req.session.user.id, req.params.id, 'En attente']);
  res.redirect(303, '/dashboard');
});

router.get('/chat', ensureAuth, async (req, res) => {
  const currentUser = req.session.user;
  const contacts = currentUser.role === 'professor'
    ? await all("SELECT id, full_name, role, department FROM users WHERE role='student' ORDER BY full_name")
    : await all("SELECT id, full_name, role, department FROM users WHERE role='professor' ORDER BY full_name");

  const activeContactId = Number(req.query.user || (contacts[0] && contacts[0].id));
  const messages = activeContactId ? await all(`SELECT * FROM messages
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    ORDER BY id ASC`, [currentUser.id, activeContactId, activeContactId, currentUser.id]) : [];

  res.render('public/chat', {
    title: 'Chat encadrant',
    contacts,
    activeContactId,
    messages,
    currentUser
  });
});


// ── SOUMETTRE UN RAPPORT (étudiant ou professeur) ──────────────────
router.post('/student/reports', ensureAuth, (req, res, next) => {
  uploadReport.single('pdf_file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).send('Le fichier PDF dépasse 10 Mo.');
    if (err) return res.status(400).send(err.message);
    next();
  });
}, async (req, res) => {
  const user = req.session.user;
  const { title, year, specialty, summary, file_url } = req.body;
  // student_name : fourni par prof, ou nom de session pour étudiant
  const student_name = req.body.student_name || user.full_name;

  const uploadedUrl = req.file ? `/uploads/reports/${req.file.filename}` : '';
  const finalUrl = uploadedUrl || (file_url || '').trim();

  if (!finalUrl) {
    return res.status(400).send('Veuillez ajouter un fichier PDF ou un lien PDF.');
  }

  await run(
    'INSERT INTO reports (title, student_name, year, specialty, summary, file_url) VALUES (?, ?, ?, ?, ?, ?)',
    [title, student_name, year || '', specialty || '', summary || '', finalUrl]
  );
  res.redirect(303, '/dashboard');
});

module.exports = router;
