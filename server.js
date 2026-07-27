'use strict';

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { validateEnv } = require('./src/config/env');
validateEnv();

const express = require('express');
const path    = require('path');

const webhookRoutes = require('./src/routes/webhookRoutes');
const apiRoutes     = require('./src/routes/apiRoutes');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));

// ── Rutas ────────────────────────────────────────────────────────────────────
app.use('/webhook', webhookRoutes);
app.use('/api',     apiRoutes);

// ── HTML principal ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// ── Iniciar servidor ──────────────────────────────────────────────────────────
if (!process.env.DONT_LISTEN) {
  app.listen(PORT, () => {
    console.log(`🚀 CRM Faroles Geniuss v2 corriendo en puerto ${PORT}`);
  });
}

module.exports = app;
