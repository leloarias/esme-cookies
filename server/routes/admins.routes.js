const express = require('express');
const bcrypt = require('bcryptjs');
const { prepare } = require('../database');
const { verifyToken } = require('../auth');

const router = express.Router();

router.get('/api/administradores', verifyToken, async (req, res) => {
  try {
    const admins = await prepare('SELECT id, username FROM administradores').all();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener admins' });
  }
});

router.post('/api/administradores', verifyToken, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    await prepare('INSERT INTO administradores (username, password_hash) VALUES (?, ?)').run(username, hash);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear admin, posible usuario duplicado' });
  }
});

router.put('/api/administradores/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Falta contraseña' });
  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    await prepare('UPDATE administradores SET password_hash = ? WHERE id = ?').run(hash, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar admin' });
  }
});

router.delete('/api/administradores/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  try {
    const row = await prepare('SELECT COUNT(*) as c FROM administradores').get();
    if (row.c <= 1) return res.status(400).json({ error: 'No se puede eliminar el único administrador' });
    await prepare('DELETE FROM administradores WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar admin' });
  }
});

module.exports = router;
