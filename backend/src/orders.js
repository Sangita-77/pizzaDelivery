const { Router } = require('express');
const mongoose = require('mongoose');
const { Order, MenuItem, User, clean } = require('./models');
const { builderPrice } = require('./builder');
const { PROMOS } = require('./promo');

const router = Router();
router.catchUpAll = catchUpAll;

// Menu pizza size pricing: medium is the base price.
const SIZE_DELTAS = { small: -3, medium: 0, large: 4 };
const SIZE_NAMES = { small: 'Personal 8"', medium: 'Classic 11"', large: 'Grande 14"' };
const DELIVERY_FEE = 2.99;
const FREE_DELIVERY_OVER = 30;
const TAX_RATE = 0.05;
// Compressed demo timeline in seconds from placement (full journey ~3.5 min).
const TIMELINE = [
  ['placed', 0],
  ['confirmed', 12],
  ['baking', 30],
  ['quality_check', 75],
  ['out_for_delivery', 105],
  ['delivered', 195],
];
const DRIVERS = [
  { name: 'Marco Rossi', phone: '+1 555 0124', vehicle: 'Vespa • FN 21 34' },
  { name: 'Anna Conti', phone: '+1 555 0198', vehicle: 'Fiat 500 • AB 12 90' },
  { name: 'Luca Bianchi', phone: '+1 555 0176', vehicle: 'E-Bike • FRN 88' },
];

const round2 = (n) => Math.round(n * 100) / 100;
const clampInt = (v, min, max) => Math.max(min, Math.min(max, Number.parseInt(v, 10) || min));

function computePricing(subtotal, promo) {
  const discount = promo?.pct ? round2((subtotal * promo.pct) / 100) : 0;
  const deliveryFee = promo?.freeDelivery || subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
  const taxable = Math.max(0, round2(subtotal - discount));
  const tax = round2(taxable * TAX_RATE);
  const total = round2(taxable + deliveryFee + tax);
  return { subtotal: round2(subtotal), discount, deliveryFee, tax, total };
}

// Prices and validates the raw item list. Throws { status, message } on any problem.
async function priceItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    const err = new Error('Your cart is empty');
    err.status = 400;
    throw err;
  }
  const keys = rawItems.filter((i) => i.type === 'menu').map((i) => String(i.key || ''));
  const menuDocs = await MenuItem.find({ key: { $in: keys } }).lean();
  const byKey = new Map(menuDocs.map((d) => [d.key, d]));

  const items = rawItems.slice(0, 30).map((raw) => {
    const qty = clampInt(raw.qty, 1, 20);
    if (raw.type === 'menu') {
      const doc = byKey.get(String(raw.key || ''));
      if (!doc) {
        const err = new Error('One of the items is no longer on the menu');
        err.status = 400;
        throw err;
      }
      const size = SIZE_DELTAS[raw.size] !== undefined ? raw.size : 'medium';
      return {
        type: 'menu',
        key: doc.key,
        name: doc.name,
        image: doc.image,
        qty,
        unitPrice: round2(doc.basePrice + SIZE_DELTAS[size]),
        details: { size, sizeName: SIZE_NAMES[size] },
      };
    }
    // custom pizza — priced server-side from the builder config
    const priced = builderPrice(raw.details || {});
    return {
      type: 'custom',
      name: `Build-Your-Own • ${priced.sizeName}`,
      image: '',
      qty,
      unitPrice: priced.unitPrice,
      details: {
        size: (raw.details || {}).size,
        crust: (raw.details || {}).crust,
        sauce: (raw.details || {}).sauce,
        cheese: (raw.details || {}).cheese,
        toppings: priced.toppings,
      },
    };
  });

  const subtotal = round2(items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0));
  return { items, subtotal };
}

router.post('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: 'Please sign in to continue' });

    const { items: priced, subtotal } = await priceItems(req.body.items);

    // Resolve the delivery address (saved by id, or inline + optional save).
    let address = null;
    const saveAddress = req.body.saveAddress === true;
    if (req.body.addressId) {
      address = user.addresses.find((a) => a.id === req.body.addressId);
      if (!address) return res.status(400).json({ error: 'Delivery address not found' });
      address = typeof address.toObject === 'function' ? address.toObject() : { ...address };
    } else {
      const inline = req.body.address || {};
      const line1 = String(inline.line1 || '').trim();
      const city = String(inline.city || '').trim();
      const zip = String(inline.zip || '').trim();
      if (!line1 || !city || !zip) return res.status(400).json({ error: 'Please add a delivery address' });
      address = {
        id: Math.random().toString(36).slice(2),
        label: String(inline.label || 'Delivery').trim() || 'Delivery',
        line1, city, zip,
        note: String(inline.note || '').trim(),
      };
      const duplicate = user.addresses.some(
        (a) => a.line1.toLowerCase() === line1.toLowerCase() && a.zip === zip,
      );
      if (saveAddress && !duplicate) user.addresses.push(address);
    }

    // Promo
    let promo = null;
    const code = String(req.body.promoCode || '').trim().toUpperCase();
    if (code) {
      promo = PROMOS[code];
      if (!promo) return res.status(400).json({ error: `Promo code ${code} is not valid` });
      promo = { code, ...promo };
    }

    const pricing = computePricing(subtotal, promo);
    const driver = DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
    const order = await Order.create({
      number: (await Order.countDocuments()) + 1001,
      user: user._id,
      items: priced,
      address,
      notes: String(req.body.notes || '').trim(),
      paymentMethod: 'cod',
      promo,
      pricing,
      status: 'placed',
      statusHistory: [{ status: 'placed', at: new Date() }],
      driver,
      etaMinutes: 28,
    });
    await user.save();
    schedule(order);
    res.status(201).json({ order: clean(order) });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const query = { user: req.userId };
    if (req.query.active === '1') query.status = { $ne: 'delivered' };
    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ orders: clean(orders) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const order = await Order.findOne({ _id: req.params.id, user: req.userId }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: clean(order) });
  } catch (err) {
    next(err);
  }
});

// ---- Live status progression (compressed demo timeline) ----
async function advance(o) {
  const created = o.createdAt.getTime();
  const elapsedSec = (Date.now() - created) / 1000;
  let target = 'placed';
  let targetSec = 0;
  for (const [status, sec] of TIMELINE) {
    if (elapsedSec >= sec) {
      target = status;
      targetSec = sec;
    }
  }
  if (o.status === target) return;
  const have = new Set(o.statusHistory.map((h) => h.status));
  const history = [...o.statusHistory];
  for (const [status, sec] of TIMELINE) {
    if (sec <= targetSec && !have.has(status)) history.push({ status, at: new Date(created + sec * 1000) });
  }
  history.sort((a, b) => new Date(a.at) - new Date(b.at));
  o.status = target;
  o.statusHistory = history;
  if (target === 'delivered' && !o.deliveredAt) o.deliveredAt = new Date(created + targetSec * 1000);
  await o.save();
}

function schedule(o) {
  const created = o.createdAt.getTime();
  const elapsedSec = (Date.now() - created) / 1000;
  const idx = TIMELINE.findIndex(([s]) => s === o.status);
  for (let i = idx + 1; i < TIMELINE.length; i++) {
    const [status, sec] = TIMELINE[i];
    const delay = Math.max(0, (sec - elapsedSec) * 1000);
    setTimeout(() => {
      Order.updateOne(
        { _id: o._id, status: { $nin: [status, 'delivered'] } },
        {
          status,
          $push: { statusHistory: { status, at: new Date() } },
          ...(status === 'delivered' ? { deliveredAt: new Date() } : {}),
        },
      ).exec().catch(() => {});
    }, delay);
  }
}

async function catchUpAll() {
  try {
    const stale = await Order.find({ status: { $ne: 'delivered' } });
    for (const o of stale) {
      await advance(o);
      schedule(o);
    }
    if (stale.length) console.log(`[orders] caught up ${stale.length} in-flight order(s)`);
  } catch (err) {
    console.error('[orders] catchUpAll failed:', err.message);
  }
}

module.exports = router;
