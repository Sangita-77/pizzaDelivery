const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('crypto');

const { User, clean } = require('./models');

const router = Router();
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  // Behind ingress + local proxy: key on the original client IP.
  keyGenerator: (req) => String(req.get('x-forwarded-for') || req.ip || '').split(',')[0].trim(),
  validate: { xForwardedForHeader: false, trustProxy: false, ip: false, keyGeneratorIpFallback: false },
});

if (!process.env.JWT_SECRET) {
  console.error('[auth] JWT_SECRET missing — add it to backend/.env');
}

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '30d',
  });
}

const plain = (x) => (typeof x?.toObject === 'function' ? x.toObject() : { ...x });

function publicUser(u) {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role || 'customer',
    addresses: u.addresses.map(plain),
    favorites: (u.favorites || []).map(plain),
  };
}

// Role is re-read from the database on every request, never trusted from the token.
async function requireOwner(req, res, next) {
  try {
    const user = await User.findById(req.userId, { role: 1 }).lean();
    if (!user) return res.status(401).json({ error: 'Account not found' });
    if (user.role !== 'owner') return res.status(403).json({ error: 'Owner access required' });
    next();
  } catch (err) {
    next(err);
  }
}

// Idempotent: creates the owner once, never overwrites an existing password.
async function seedOwner() {
  const email = String(process.env.OWNER_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.OWNER_PASSWORD || '');
  if (!email || !password) {
    console.warn('[auth] OWNER_EMAIL / OWNER_PASSWORD not set — no kitchen account seeded');
    return;
  }
  const existing = await User.findOne({ email }, { role: 1 }).lean();
  if (existing) {
    if (existing.role !== 'owner') await User.updateOne({ _id: existing._id }, { $set: { role: 'owner' } });
    console.log(`[auth] owner account ready: ${email}`);
    return;
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({ name: 'Fornello Kitchen', email, passwordHash, role: 'owner', addresses: [], favorites: [] });
    console.log(`[auth] owner account created: ${email}`);
  } catch (err) {
    if (err?.code !== 11000) throw err; // another instance created it first
  }
}

function sameFavorite(a, b) {
  return a.kind === b.kind && (a.key || '') === (b.key || '') && JSON.stringify(a.details ?? null) === JSON.stringify(b.details ?? null);
}

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Please sign in to continue' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

async function loadUser(req, res, next) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  req.user = user;
  next();
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2) return res.status(400).json({ error: 'Please enter your name' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, phone: '', addresses: [] });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email }).select('+passwordHash');
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, loadUser, (req, res) => res.json({ user: publicUser(req.user) }));

router.put('/me', requireAuth, loadUser, async (req, res, next) => {
  try {
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2) return res.status(400).json({ error: 'Please enter your name' });
      req.user.name = name;
    }
    if (req.body.phone !== undefined) req.user.phone = String(req.body.phone).trim();
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/addresses', requireAuth, loadUser, async (req, res, next) => {
  try {
    const label = String(req.body.label || 'Home').trim() || 'Home';
    const line1 = String(req.body.line1 || '').trim();
    const city = String(req.body.city || '').trim();
    const zip = String(req.body.zip || '').trim();
    const note = String(req.body.note || '').trim();
    if (!line1 || !city || !zip) return res.status(400).json({ error: 'Street, city and ZIP are required' });
    const address = { id: randomUUID(), label, line1, city, zip, note };
    req.user.addresses.push(address);
    await req.user.save();
    res.status(201).json({ user: publicUser(req.user) });
  } catch (err) {
    next(err);
  }
});

router.delete('/addresses/:addressId', requireAuth, loadUser, async (req, res, next) => {
  try {
    req.user.addresses = req.user.addresses.filter((a) => a.id !== req.params.addressId);
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/favorites', requireAuth, loadUser, async (req, res, next) => {
  try {
    const kind = req.body.kind === 'custom' ? 'custom' : 'menu';
    const name = String(req.body.name || '').trim().slice(0, 80);
    const unitPrice = Number(req.body.unitPrice);
    if (!name || !Number.isFinite(unitPrice) || unitPrice <= 0) return res.status(400).json({ error: 'Invalid favourite' });
    const fav = {
      id: randomUUID(),
      kind,
      key: String(req.body.key || ''),
      name,
      image: String(req.body.image || ''),
      unitPrice: Math.round(unitPrice * 100) / 100,
      details: req.body.details ?? null,
    };
    if (!req.user.favorites.some((f) => sameFavorite(plain(f), fav))) {
      if (req.user.favorites.length >= 30) return res.status(400).json({ error: 'You can save up to 30 favourites' });
      req.user.favorites.push(fav);
      await req.user.save();
    }
    res.status(201).json({ user: publicUser(req.user) });
  } catch (err) {
    next(err);
  }
});

router.delete('/favorites/:favId', requireAuth, loadUser, async (req, res, next) => {
  try {
    req.user.favorites = req.user.favorites.filter((f) => f.id !== req.params.favId);
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireOwner = requireOwner;
module.exports.seedOwner = seedOwner;
