const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Подключаем базу данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Ссылку возьмем из настроек Render
  ssl: { rejectUnauthorized: false }
});

app.use(express.static('public')); // Разрешаем серверу показывать файлы из папки public

// Когда кто-то заходит на сайт
io.on('connection', (socket) => {
  console.log('Кто-то подключился');

  // Когда пользователь присылает вопрос
  socket.on('user_question', async (data) => {
    // Сохраняем вопрос в базу
    const res = await pool.query(
      'INSERT INTO tickets (question, status) VALUES ($1, $2) RETURNING id',
      [data.text, 'pending']
    );
    
    const ticketId = res.rows[0].id;

    // Отправляем админам уведомление о новом вопросе
    io.emit('new_ticket', { id: ticketId, text: data.text });
  });

  // Когда админ отвечает
  socket.on('admin_answer', async (data) => {
    // Обновляем запись в базе
    await pool.query('UPDATE tickets SET answer = $1, status = $2 WHERE id = $3', 
    [data.answer, 'completed', data.ticketId]);

    // Отправляем ответ обратно игроку
    io.emit('answer_to_user', { ticketId: data.ticketId, answer: data.answer });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));