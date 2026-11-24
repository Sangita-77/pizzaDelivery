// Shop-owner kitchen dashboard API. Mounted behind requireAuth + requireOwner.
const { Router } = require('express');
const mongoose = require('mongoose');
const { Order, clean } = require('./models');

const router = Router();

// Each status may only move to the next step in the kitchen flow.
const NEXT = {
  placed: 'confirmed',
  confirmed: 'baking',
  baking: 'quality_check',
  quality_check: 'out_for_delivery',
  out_for_delivery: 'delivered',
};
const CANCELLABLE = ['placed', 'confirmed', 'baking', 'quality_check'];
const FILTERS = {
  new: { status: 'placed' },
  active: { status: { $in: ['confirmed', 'baking', 'quality_check', 'out_for_delivery'] } },
  done: { status: { $in: ['delivered', 'cancelled'] } },
};

function withCustomer(o) {
  const customer = o.user && typeof o.user === 'object' ? { name: o.user.name, email: o.user.email, phone: o.user.phone || '' } : null;
  return { ...clean({ ...o, user: o.user?._id ?? o.user }), customer };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get('/orders', async (req, res, next) => {
  try {
    const query = FILTERS[req.query.filter] || FILTERS.new;
    const sort = req.query.filter === 'done' ? { updatedAt: -1 } : { createdAt: 1 };
    const orders = await Order.find(query).sort(sort).limit(100).populate('user', 'name email phone').lean();
    res.json({ orders: orders.map(withCustomer) });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const today = startOfToday();
    const [newCount, activeCount, deliveredToday, cancelledToday, rated] = await Promise.all([
      Order.countDocuments(FILTERS.new),
      Order.countDocuments(FILTERS.active),
      Order.find({ status: 'delivered', deliveredAt: { $gte: today } }, { pricing: 1 }).lean(),
      Order.countDocuments({ status: 'cancelled', updatedAt: { $gte: today } }),
      Order.find({ 'rating.stars': { $gte: 1 } }, { number: 1, items: 1, rating: 1, user: 1 })
        .sort({ 'rating.at': -1 })
        .limit(500)
        .populate('user', 'name')
        .lean(),
    ]);

    // Every item in a rated order shares that order's stars.
    const byItem = new Map();
    let starSum = 0;
    for (const o of rated) {
      starSum += o.rating.stars;
      for (const it of o.items) {
        const name = it.type === 'custom' ? 'Build-Your-Own' : it.name;
        const row = byItem.get(name) || { name, image: it.image || '', total: 0, count: 0 };
        row.total += o.rating.stars;
        row.count += 1;
        byItem.set(name, row);
      }
    }
    const items = [...byItem.values()]
      .map((r) => ({ name: r.name, image: r.image, count: r.count, average: Math.round((r.total / r.count) * 10) / 10 }))
      .sort((a, b) => b.average - a.average || b.count - a.count);

    res.json({
      today: {
        newOrders: newCount,
        inProgress: activeCount,
        delivered: deliveredToday.length,
        cancelled: cancelledToday,
        revenue: Math.round(deliveredToday.reduce((s, o) => s + (o.pricing?.total || 0), 0) * 100) / 100,
      },
      ratings: {
        count: rated.length,
        average: rated.length ? Math.round((starSum / rated.length) * 10) / 10 : 0,
        items,
        recent: rated.slice(0, 10).map((o) => ({
          orderId: String(o._id),
          number: o.number,
          stars: o.rating.stars,
          comment: o.rating.comment,
          at: o.rating.at,
          customer: o.user?.name || 'Customer',
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/advance', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const current = await Order.findById(req.params.id, { status: 1 }).lean();
    if (!current) return res.status(404).json({ error: 'Order not found' });
    const to = NEXT[current.status];
    if (!to) return res.status(409).json({ error: `Order is already ${current.status.replace(/_/g, ' ')}` });
    const now = new Date();
    // Conditional update guards against two devices advancing the same order.
    const updated = await Order.findOneAndUpdate(
      { _id: req.params.id, status: current.status },
      { $set: { status: to, ...(to === 'delivered' ? { deliveredAt: now } : {}) }, $push: { statusHistory: { status: to, at: now } } },
      { new: true },
    )
      .populate('user', 'name email phone')
      .lean();
    if (!updated) return res.status(409).json({ error: 'Order was just updated, please refresh' });
    res.json({ order: withCustomer(updated) });
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/cancel', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const reason = String(req.body.reason || '').trim().slice(0, 200) || 'The restaurant could not take this order';
    const now = new Date();
    const updated = await Order.findOneAndUpdate(
      { _id: req.params.id, status: { $in: CANCELLABLE } },
      { $set: { status: 'cancelled', cancelReason: reason }, $push: { statusHistory: { status: 'cancelled', at: now } } },
      { new: true },
    )
      .populate('user', 'name email phone')
      .lean();
    if (!updated) {
      const exists = await Order.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ error: 'Order not found' });
      return res.status(409).json({ error: 'This order can no longer be cancelled' });
    }
    res.json({ order: withCustomer(updated) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
