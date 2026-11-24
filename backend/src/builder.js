const { Router } = require('express');

// Single source of truth for custom pizza pricing (also served to the client).
const BUILDER_CONFIG = {
  basePrice: 9.9,
  sizes: [
    { id: 'small', name: 'Personal 8"', delta: 0 },
    { id: 'medium', name: 'Classic 11"', delta: 3 },
    { id: 'large', name: 'Grande 14"', delta: 6 },
  ],
  crusts: [
    { id: 'hand_tossed', name: 'Hand-Tossed', delta: 0 },
    { id: 'thin', name: 'Thin & Crispy', delta: 0 },
    { id: 'sourdough', name: 'Wood-Fired Sourdough', delta: 2 },
    { id: 'cheese_burst', name: 'Cheese Burst', delta: 2.5 },
  ],
  sauces: [
    { id: 'tomato', name: 'San Marzano Tomato', delta: 0 },
    { id: 'bbq', name: 'Smoky BBQ', delta: 1 },
    { id: 'pesto', name: 'Basil Pesto', delta: 1.25 },
    { id: 'arrabbiata', name: 'Spicy Arrabbiata', delta: 0.5 },
  ],
  cheeses: [
    { id: 'fior', name: 'Fior di Latte', delta: 0 },
    { id: 'blend', name: 'Three-Cheese Blend', delta: 1 },
    { id: 'vegan', name: 'Vegan Mozzarella', delta: 1.25 },
    { id: 'extra', name: 'Extra Cheese', delta: 2 },
  ],
  toppings: [
    { id: 'pepperoni', name: 'Pepperoni', delta: 1.75, veg: false },
    { id: 'grilled_chicken', name: 'Grilled Chicken', delta: 1.9, veg: false },
    { id: 'bacon', name: 'Smoked Bacon', delta: 2, veg: false },
    { id: 'sausage', name: 'Fennel Sausage', delta: 1.9, veg: false },
    { id: 'ham', name: 'Smoked Ham', delta: 1.8, veg: false },
    { id: 'mushrooms', name: 'Wild Mushrooms', delta: 1.25, veg: true },
    { id: 'olives', name: 'Kalamata Olives', delta: 1, veg: true },
    { id: 'onions', name: 'Caramelized Onion', delta: 0.75, veg: true },
    { id: 'bell_peppers', name: 'Roasted Peppers', delta: 1, veg: true },
    { id: 'jalapenos', name: 'Jalapeños', delta: 0.9, veg: true },
    { id: 'pineapple', name: 'Grilled Pineapple', delta: 1, veg: true },
    { id: 'sweet_corn', name: 'Sweet Corn', delta: 0.9, veg: true },
    { id: 'fresh_basil', name: 'Fresh Basil', delta: 0.75, veg: true },
    { id: 'cherry_tomatoes', name: 'Cherry Tomatoes', delta: 1, veg: true },
  ],
};

// Prices a custom pizza from raw selection ids. Throws a 400-shaped error on invalid ids.
function builderPrice(details) {
  const size = BUILDER_CONFIG.sizes.find((s) => s.id === details.size);
  const crust = BUILDER_CONFIG.crusts.find((c) => c.id === details.crust);
  const sauce = BUILDER_CONFIG.sauces.find((s) => s.id === details.sauce);
  const cheese = BUILDER_CONFIG.cheeses.find((c) => c.id === details.cheese);
  if (!size || !crust || !sauce || !cheese) {
    const err = new Error('Invalid pizza configuration');
    err.status = 400;
    throw err;
  }
  const toppingIds = Array.isArray(details.toppings) ? details.toppings : [];
  const toppings = [];
  let toppingsDelta = 0;
  for (const id of toppingIds) {
    const t = BUILDER_CONFIG.toppings.find((x) => x.id === id);
    if (!t) {
      const err = new Error(`Unknown topping: ${id}`);
      err.status = 400;
      throw err;
    }
    if (!toppings.includes(t.id)) {
      toppings.push(t.id);
      toppingsDelta += t.delta;
    }
  }
  const unitPrice = Math.round((BUILDER_CONFIG.basePrice + size.delta + crust.delta + sauce.delta + cheese.delta + toppingsDelta) * 100) / 100;
  return { unitPrice, sizeName: size.name, toppings };
}

const router = Router();
router.get('/', (req, res) => res.json(BUILDER_CONFIG));

module.exports = { builderRouter: router, BUILDER_CONFIG, builderPrice };
