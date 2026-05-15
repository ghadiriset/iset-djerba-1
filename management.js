const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { run, get } = require('../db');
const { ensureRole } = require('../middleware');
const router = express.Router();

const reportsUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'reports');
fs.mkdirSync(reportsUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reportsUploadDir),
  filename: (req, file, cb) => {
    const safeBaseName = (path.parse(file.originalname).name || 'rapport')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    cb(null, `${Date.now()}-${safeBaseName || 'rapport'}.pdf`);
  }
});

const uploadReportPdf = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const hasPdfExtension = path.extname(file.originalname || '').toLowerCase() === '.pdf';

    if (isPdfMime || hasPdfExtension) {
      return cb(null, true);
    }

    cb(new Error('Seuls les fichiers PDF sont autorisés.'));
  }
});

function handleReportPdfUpload(req, res, next) {
  uploadReportPdf.single('pdf_file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('Le fichier PDF dépasse la taille maximale autorisée de 10 Mo.');
    }

    return res.status(400).send(err.message || 'Impossible de téléverser ce fichier PDF.');
  });
}

router.post('/admin/users', ensureRole('admin'), async (req, res) => {
  const { full_name, email, password, role, department, promotion } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await run('INSERT INTO users (full_name, email, password, role, department, promotion) VALUES (?, ?, ?, ?, ?, ?)', [
    full_name, email, hashed, role, department, promotion
  ]);
  res.redirect(303, '/dashboard');
});

router.post('/admin/users/:id/delete', ensureRole('admin'), async (req, res) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).send('Identifiant utilisateur invalide.');
  }

  // Empêcher l'admin de se supprimer lui-même
  if (userId === req.session.user.id) {
    return res.status(400).send('Vous ne pouvez pas supprimer votre propre compte.');
  }

  const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.redirect(303, '/dashboard');
  }

  await run('DELETE FROM users WHERE id = ?', [userId]);
  res.redirect(303, '/dashboard');
});

router.post('/admin/companies', ensureRole('admin'), async (req, res) => {
  const { name, sector, location, description, contact_email, website } = req.body;
  await run('INSERT INTO companies (name, sector, location, description, contact_email, website) VALUES (?, ?, ?, ?, ?, ?)', [
    name, sector, location, description, contact_email, website
  ]);
  res.redirect(303, '/dashboard');
});

router.post('/admin/internships', ensureRole('admin'), async (req, res) => {
  const { company_id, title, description, duration, location, paid, status } = req.body;
  await run('INSERT INTO internships (company_id, title, description, duration, location, paid, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    company_id, title, description, duration, location, paid, status
  ]);
  res.redirect(303, '/dashboard');
});

router.post('/admin/reports', ensureRole('admin'), handleReportPdfUpload, async (req, res) => {
  const { title, student_name, year, specialty, summary, file_url } = req.body;
  const uploadedFileUrl = req.file ? `/uploads/reports/${req.file.filename}` : '';
  const finalFileUrl = uploadedFileUrl || (file_url || '').trim();

  if (!finalFileUrl) {
    return res.status(400).send('Veuillez ajouter un fichier PDF ou un lien PDF valide pour le rapport.');
  }

  await run('INSERT INTO reports (title, student_name, year, specialty, summary, file_url) VALUES (?, ?, ?, ?, ?, ?)', [
    title, student_name, year, specialty, summary, finalFileUrl
  ]);
  res.redirect(303, '/dashboard');
});

router.post('/admin/reports/:id/delete', ensureRole('admin'), async (req, res) => {
  const reportId = Number(req.params.id);

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(400).send('Identifiant du rapport invalide.');
  }

  const report = await get('SELECT * FROM reports WHERE id = ?', [reportId]);
  if (!report) {
    return res.redirect(303, '/dashboard');
  }

  if (report.file_url && report.file_url.startsWith('/uploads/reports/')) {
    const filePath = path.join(__dirname, '..', 'public', report.file_url.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  await run('DELETE FROM reports WHERE id = ?', [reportId]);
  res.redirect(303, '/dashboard');
});

module.exports = router;
