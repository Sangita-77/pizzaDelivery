const { Router } = require('express');
const { MenuItem, clean } = require('./models');

const router = Router();

const MENU_SEED = [
  {
    key: 'margherita',
    name: 'Margherita Fiore',
    description: 'San Marzano tomato, fior di latte, torn basil, Ligurian olive oil — blistered in the wood oven.',
    category: 'pizza', veg: true, spicy: false, image: '/menu/margherita.jpg', popular: true, basePrice: 10.9, hasSizes: true,
  },
  {
    key: 'pepperoni-classic',
    name: 'Double Pepperoni',
    description: 'Cupping pepperoni twice over, slow-smoked tomato sauce, mozzarella, calabrian chili honey.',
    category: 'pizza', veg: false, spicy: true, image: '/menu/pepperoni.jpg', popular: true, basePrice: 13.9, hasSizes: true,
  },
  {
    key: 'bbq-chicken',
    name: 'BBQ Chicken Flame',
    description: 'Smoky BBQ base, flame-grilled chicken, red onion, charred corn, cilantro crema.',
    category: 'pizza', veg: false, spicy: false, image: '/menu/bbq-chicken.jpg', popular: true, basePrice: 14.9, hasSizes: true,
  },
  {
    key: 'hawaiian',
    name: 'Hawaiian Sole',
    description: 'Grilled pineapple, smoked ham, mozzarella, a whisper of rosemary — sweet meets fire.',
    category: 'pizza', veg: false, spicy: false, image: '/menu/hawaiian.jpg', popular: false, basePrice: 13.5, hasSizes: true,
  },
  {
    key: 'four-cheese',
    name: 'Quattro Formaggi',
    description: 'Fior di latte, gorgonzola dolce, aged parmesan, smoked scamorza, walnut crumble.',
    category: 'pizza', veg: true, spicy: false, image: '/menu/four-cheese.jpg', popular: true, basePrice: 15.5, hasSizes: true,
  },
  {
    key: 'veggie-supreme',
    name: 'Garden Ember',
    description: 'Roasted peppers, charred zucchini, caramelized onion, olives, basil, oregano oil.',
    category: 'pizza', veg: true, spicy: false, image: '/menu/veggie.jpg', popular: false, basePrice: 13.9, hasSizes: true,
  },
  {
    key: 'paneer-tikka',
    name: 'Paneer Tikka Masala',
    description: 'Tandoori paneer, pickled red onion, mint chutney drizzle, toasted cumin over tomato.',
    category: 'pizza', veg: true, spicy: true, image: '/menu/paneer-tikka.jpg', popular: false, basePrice: 14.5, hasSizes: true,
  },
  {
    key: 'truffle-mushroom',
    name: 'Truffle Mushroom',
    description: 'Wild mushrooms, taleggio, black truffle cream, thyme, crispy shallots.',
    category: 'pizza', veg: true, spicy: false, image: '/menu/truffle-mushroom.jpg', popular: true, basePrice: 16.5, hasSizes: true,
  },
  {
    key: 'garlic-bread',
    name: 'Wood-Fired Garlic Breadsticks',
    description: 'Hand-stretched dough, roasted garlic butter, parmesan snow, herb oil for dipping.',
    category: 'sides', veg: true, spicy: false, image: '/menu/garlic-bread.jpg', popular: true, basePrice: 6.5, hasSizes: false,
  },
  {
    key: 'chicken-wings',
    name: 'Flame Chicken Wings',
    description: 'Six wings lacquered in gochujang-maple glaze, toasted sesame, lime crema.',
    category: 'sides', veg: false, spicy: true, image: '/menu/chicken-wings.jpg', popular: false, basePrice: 8.9, hasSizes: false,
  },
  {
    key: 'lava-cake',
    name: 'Molten Chocolate Lava Cake',
    description: 'Valrhona dark chocolate core, sea salt, dusted cocoa — molten on arrival.',
    category: 'desserts', veg: true, spicy: false, image: '/menu/lava-cake.jpg', popular: true, basePrice: 6.9, hasSizes: false,
  },
  {
    key: 'cola',
    name: 'Artisan Cola 330ml',
    description: 'Small-batch cane sugar cola with kola nut, citrus and warm spice.',
    category: 'drinks', veg: true, spicy: false, image: '/menu/cola.jpg', popular: false, basePrice: 2.9, hasSizes: false,
  },
  {
    key: 'lemonade',
    name: 'Sicilian Lemonade',
    description: 'Cold-pressed Sicilian lemons, raw honey, sparkling spring water, mint.',
    category: 'drinks', veg: true, spicy: false, image: '/menu/lemonade.jpg', popular: true, basePrice: 3.5, hasSizes: false,
  },
];

async function ensureSeed() {
  const count = await MenuItem.estimatedDocumentCount();
  if (count > 0) return;
  await MenuItem.insertMany(MENU_SEED.map((m) => ({ ...m })));
  console.log(`[menu] seeded ${MENU_SEED.length} items`);
}

router.get('/', async (req, res, next) => {
  try {
    const ORDER = { pizza: 0, sides: 1, desserts: 2, drinks: 3 };
    const items = (await MenuItem.find({}).lean()).sort(
      (a, b) => ORDER[a.category] - ORDER[b.category] || Number(b.popular) - Number(a.popular) || a.basePrice - b.basePrice,
    );
    res.json({ items: clean(items) });
  } catch (err) {
    next(err);
  }
});

router.get('/:key', async (req, res, next) => {
  try {
    const item = await MenuItem.findOne({ key: req.params.key }).lean();
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: clean(item) });
  } catch (err) {
    next(err);
  }
});

module.exports = { menuRouter: router, ensureSeed };
