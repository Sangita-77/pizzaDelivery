// Fornello Artisan Pizza API — Node.js (Express) + MongoDB (Mongoose).
// Listens on NODE_PORT (default 8007). The platform-managed entrypoint on 8001
// forwards every /api/* request here, and static menu images are served from
// /api/images/... so they pass through the same ingress route.
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const authRouter = require('./src/auth');
const { menuRouter, ensureSeed } = require('./src/menu');
const { BUILDER_CONFIG } = require('./src/builder');
const ordersRouter = require('./src/orders');
const { promoRouter } = require('./src/promo');
const kitchenRouter = require('./src/kitchen');

const PORT = Number(process.env.PORT || 8007);

const app = express();
app.use(helmet({ crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '200kb' }));

// Menu photography served through the /api ingress route.
app.use('/api/images', express.static(path.join(__dirname, 'public'), { maxAge: '7d', immutable: true }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'fornello-api' }));
app.get('/api/builder-config', (req, res) => res.json(BUILDER_CONFIG));

app.use('/api/auth', authRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', authRouter.requireAuth, ordersRouter);
app.use('/api/promo', promoRouter);
app.use('/api/kitchen', authRouter.requireAuth, authRouter.requireOwner, kitchenRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[api]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function connectDb(retries = 60) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(process.env.MONGO_URL, { dbName: process.env.DB_NAME || 'test_database' });
      console.log('[api] MongoDB connected');
      return;
    } catch (err) {
      console.error(`[api] MongoDB connect attempt ${attempt}/${retries} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('MongoDB connection failed after retries');
}

app.listen(PORT, '0.0.0.0', () => console.log(`[api] Fornello API listening on ${PORT}`));

connectDb()
  .then(() => ensureSeed())
  .then(() => authRouter.seedOwner())
  .catch((err) => {
    console.error('[api] startup failure:', err);
    process.exit(1);
  });

module.exports = app;
