const { Router } = require('express');

const router = Router();

const PROMOS = {
  WELCOME10: { label: '10% off your order', pct: 10 },
  FREEDEL: { label: 'Free delivery on us', freeDelivery: true },
};

router.post('/validate', (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const subtotal = Number(req.body.subtotal || 0);
  const promo = PROMOS[code];
  if (!promo) return res.status(400).json({ error: `Promo code ${code || '—'} is not valid` });
  res.json({
    code,
    label: promo.label,
    pct: promo.pct || 0,
    discount: promo.pct ? Math.round(subtotal * promo.pct) / 100 : 0,
    freeDelivery: Boolean(promo.freeDelivery),
  });
});

module.exports = { promoRouter: router, PROMOS };
