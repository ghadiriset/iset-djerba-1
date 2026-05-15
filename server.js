const express = require('express');
const http = require('http');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { initDb, run } = require('./db');
const { injectUser } = require('./middleware');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const managementRoutes = require('./routes/management');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'iset-djerba-secret-session',
  resave: false,
  saveUninitialized: false
});
app.use(sessionMiddleware);

// Partager la session avec Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});
app.use(injectUser);

app.use('/', publicRoutes);
app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/', managementRoutes);

io.on('connection', (socket) => {
  // Récupérer l'utilisateur depuis la session serveur
  const user = socket.request.session && socket.request.session.user;

  socket.on('join-room', () => {
    if (!user) return;
    socket.join(`user_${user.id}`);
  });

  socket.on('private-message', async (payload) => {
    // senderId vient toujours de la SESSION, jamais du client
    if (!user) return;
    const senderId = user.id;
    const { receiverId, content } = payload;
    if (!receiverId || !content || !content.trim()) return;

    await run('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [senderId, receiverId, content.trim()]);
    const message = {
      sender_id: senderId,
      receiver_id: receiverId,
      content: content.trim(),
      created_at: new Date().toISOString()
    };

    io.to(`user_${senderId}`).to(`user_${receiverId}`).emit('message-received', message);
  });
});

app.use((req, res) => {
  res.status(404).render('public/404', { title: 'Page introuvable' });
});

initDb().then(() => {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Plateforme lancée sur http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erreur démarrage:', err);
});
