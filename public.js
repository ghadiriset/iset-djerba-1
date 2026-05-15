const express = require('express');
const router = express.Router();
const { all } = require('../db');

router.get('/', async (req, res) => {
  const companies = await all('SELECT * FROM companies ORDER BY id DESC LIMIT 3');
  const internships = await all(`SELECT internships.*, companies.name AS company_name
                                  FROM internships JOIN companies ON companies.id = internships.company_id
                                  ORDER BY internships.id DESC LIMIT 4`);
  const reports = await all('SELECT * FROM reports ORDER BY id DESC LIMIT 3');
  res.render('public/home', { title: 'Accueil', companies, internships, reports });
});

router.get('/entreprises', async (req, res) => {
  const companies = await all('SELECT * FROM companies ORDER BY name');
  res.render('public/companies', { title: 'Entreprises', companies });
});

router.get('/stages', async (req, res) => {
  const internships = await all(`SELECT internships.*, companies.name AS company_name, companies.sector
                                  FROM internships JOIN companies ON companies.id = internships.company_id
                                  ORDER BY internships.created_at DESC`);
  res.render('public/internships', { title: 'Offres de stage', internships });
});

router.get('/rapports', async (req, res) => {
  const reports = await all('SELECT * FROM reports ORDER BY year DESC, id DESC');
  res.render('public/reports', { title: 'Anciens rapports', reports });
});

router.get('/a-propos', (req, res) => {
  res.render('public/about', { title: 'À propos' });
});

module.exports = router;
