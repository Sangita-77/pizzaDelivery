const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    line1: { type: String, required: true },
    city: { type: String, required: true },
    zip: { type: String, required: true },
    note: { type: String, default: '' },
  },
  { _id: false },
);

const FavoriteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    kind: { type: String, enum: ['menu', 'custom'], required: true },
    key: { type: String, default: '' },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    unitPrice: { type: Number, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, default: '' },
    addresses: { type: [AddressSchema], default: [] },
    role: { type: String, enum: ['customer', 'owner'], default: 'customer' },
    favorites: { type: [FavoriteSchema], default: [] },
  },
  { timestamps: true },
);

const menuItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, enum: ['pizza', 'sides', 'desserts', 'drinks'], required: true },
    veg: { type: Boolean, default: false },
    spicy: { type: Boolean, default: false },
    image: { type: String, default: '' },
    popular: { type: Boolean, default: false },
    basePrice: { type: Number, required: true },
    hasSizes: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const orderItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['menu', 'custom'], required: true },
    key: { type: String },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    address: { type: mongoose.Schema.Types.Mixed, required: true },
    notes: { type: String, default: '' },
    paymentMethod: { type: String, default: 'cod' },
    promo: { type: mongoose.Schema.Types.Mixed, default: null },
    pricing: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, default: 'placed', index: true },
    statusHistory: {
      type: [{ status: String, at: Date }],
      default: [{ status: 'placed', at: () => new Date() }],
    },
    driver: { type: mongoose.Schema.Types.Mixed, default: null },
    etaMinutes: { type: Number, default: 28 },
    deliveredAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    rating: {
      type: new mongoose.Schema(
        { stars: { type: Number, min: 1, max: 5 }, comment: { type: String, default: '' }, at: Date },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

// Mongo docs -> plain JSON with `id` (never leak raw _id / ObjectId).
function clean(doc) {
  if (doc == null) return doc;
  if (Array.isArray(doc)) return doc.map(clean);
  const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : doc;
  if (o && o._id !== undefined) {
    o.id = typeof o._id === 'string' ? o._id : o._id.toString();
    delete o._id;
  }
  if (o && o.id && o.id.$oid) o.id = o.id.$oid; // defenSive
  if (o && o.__v !== undefined) delete o.__v;
  if (o && o.user) { o.user = String(o.user); }
  return o;
}

module.exports = {
  User: mongoose.model('User', userSchema),
  MenuItem: mongoose.model('MenuItem', menuItemSchema),
  Order: mongoose.model('Order', orderSchema),
  clean,
};
