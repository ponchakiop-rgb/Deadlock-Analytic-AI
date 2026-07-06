const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Подключение к базе данных Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 1. Сначала отдаем статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// 2. Главная страница (Игрок)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 3. СЕКРЕТНАЯ АДМИНКА (Заходи именно по этому адресу!)
// Адрес будет: твой-сайт.onrender.com/super-secret-admin-panel-983142
app.get('/super-secret-admin-panel-983142', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Логика чата
io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('user_question', async (data) => {
    try {
      const res = await pool.query(
        'INSERT INTO tickets (question, status) VALUES ($1, $2) RETURNING id',
        [data.text, 'pending']
      );
      io.emit('new_ticket', { id: res.rows[0].id, text: data.text });
    } catch (err) {
      console.error('Database Error:', err);
    }
  });

  socket.on('admin_answer', async (data) => {
    try {
      await pool.query('UPDATE tickets SET answer = $1, status = $2 WHERE id = $3', 
      [data.answer, 'completed', data.ticketId]);
      io.emit('answer_to_user', { ticketId: data.ticketId, answer: data.answer });
    } catch (err) {
      console.error('Database Error:', err);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});