const express = require('express');
const bcrypt = require('bcryptjs');
const { get, run } = require('../db');
const router = express.Router();

// ── LOGIN ──────────────────────────────────────────────
router.get('/login', (req, res) => {
  res.render('auth/login', { title: 'Connexion', error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await get('SELECT * FROM users WHERE email = ?', [email]);

  if (!user) {
    return res.status(401).render('auth/login', { title: 'Connexion', error: 'Email ou mot de passe invalide.' });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).render('auth/login', { title: 'Connexion', error: 'Email ou mot de passe invalide.' });
  }

  req.session.user = {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    department: user.department,
    promotion: user.promotion
  };

  res.redirect(303, '/dashboard');
});

// ── REGISTER ───────────────────────────────────────────
router.get('/register', (req, res) => {
  res.render('auth/register', { title: 'Inscription', error: null, success: null });
});

router.post('/register', async (req, res) => {
  const { full_name, email, password, confirm_password, role, department, promotion, grade } = req.body;

  // Validations
  if (!full_name || !email || !password || !role || !department) {
    return res.render('auth/register', {
      title: 'Inscription',
      error: 'Veuillez remplir tous les champs obligatoires.',
      success: null
    });
  }

  if (!['student', 'professor'].includes(role)) {
    return res.render('auth/register', {
      title: 'Inscription',
      error: 'Rôle invalide. Choisissez Étudiant ou Enseignant.',
      success: null
    });
  }

  if (password !== confirm_password) {
    return res.render('auth/register', {
      title: 'Inscription',
      error: 'Les mots de passe ne correspondent pas.',
      success: null
    });
  }

  if (password.length < 6) {
    return res.render('auth/register', {
      title: 'Inscription',
      error: 'Le mot de passe doit contenir au moins 6 caractères.',
      success: null
    });
  }

  // Check email already used
  const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.render('auth/register', {
      title: 'Inscription',
      error: 'Cette adresse email est déjà utilisée.',
      success: null
    });
  }

  // For professors, use grade as promotion field
  const promoValue = role === 'professor' ? (grade || 'Encadrant') : (promotion || '');

  const hashed = await bcrypt.hash(password, 10);
  await run(
    'INSERT INTO users (full_name, email, password, role, department, promotion) VALUES (?, ?, ?, ?, ?, ?)',
    [full_name, email, hashed, role, department, promoValue]
  );

  return res.render('auth/register', {
    title: 'Inscription',
    error: null,
    success: `Compte créé avec succès ! Bienvenue ${full_name}. Vous pouvez maintenant vous connecter.`
  });
});

// ── LOGOUT ─────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect(303, '/'));
});

module.exports = router;
