const { Router } = require('express');
const mongoose = require('mongoose');
const { Order, MenuItem, User, clean } = require('./models');
const { builderPrice } = require('./builder');
const { PROMOS } = require('./promo');

const router = Router();

// Menu pizza size pricing: medium is the base price.
const SIZE_DELTAS = { small: -3, medium: 0, large: 4 };
const SIZE_NAMES = { small: 'Personal 8"', medium: 'Classic 11"', large: 'Grande 14"' };
const DELIVERY_FEE = 2.99;
const FREE_DELIVERY_OVER = 30;
const TAX_RATE = 0.05;
// Status changes are made by the shop owner from the kitchen dashboard (src/kitchen.js).
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
        unitPrice: doc.hasSizes ? round2(doc.basePrice + SIZE_DELTAS[size]) : round2(doc.basePrice),
        details: doc.hasSizes ? { size, sizeName: SIZE_NAMES[size] } : null,
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
    res.status(201).json({ order: clean(order) });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const query = { user: req.userId };
    if (req.query.active === '1') query.status = { $nin: ['delivered', 'cancelled'] };
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

// Customers rate a delivered order once (1–5 stars + optional comment).
router.post('/:id/rating', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const stars = Number.parseInt(req.body.stars, 10);
    if (!(stars >= 1 && stars <= 5)) return res.status(400).json({ error: 'Please choose 1 to 5 stars' });
    const comment = String(req.body.comment || '').trim().slice(0, 500);
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.userId, status: 'delivered', rating: null },
      { $set: { rating: { stars, comment, at: new Date() } } },
      { new: true },
    ).lean();
    if (!order) {
      const existing = await Order.findOne({ _id: req.params.id, user: req.userId }, { status: 1, rating: 1 }).lean();
      if (!existing) return res.status(404).json({ error: 'Order not found' });
      if (existing.rating) return res.status(409).json({ error: 'You have already rated this order' });
      return res.status(409).json({ error: 'You can rate an order once it is delivered' });
    }
    res.json({ order: clean(order) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
