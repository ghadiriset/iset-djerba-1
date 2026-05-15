function injectUser(req, res, next) {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
}

function ensureAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function ensureRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (!roles.includes(req.session.user.role)) return res.status(403).render('public/forbidden', { title: 'Accès refusé' });
    next();
  };
}

module.exports = { injectUser, ensureAuth, ensureRole };
