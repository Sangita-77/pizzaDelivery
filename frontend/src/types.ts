export type Category = "pizza" | "sides" | "desserts" | "drinks";

export type MenuItem = {
  key: string;
  name: string;
  description: string;
  category: Category;
  veg: boolean;
  spicy: boolean;
  image: string;
  popular: boolean;
  basePrice: number;
  hasSizes: boolean;
};

export type Option = { id: string; name: string; delta: number };

export type BuilderConfig = {
  basePrice: number;
  sizes: Option[];
  crusts: Option[];
  sauces: Option[];
  cheeses: Option[];
  toppings: (Option & { veg: boolean })[];
};

export type SizeId = "small" | "medium" | "large";

export type CustomPizzaDetails = {
  size: SizeId;
  crust: string;
  sauce: string;
  cheese: string;
  toppings: string[];
};

export type Address = {
  id: string;
  label: string;
  line1: string;
  city: string;
  zip: string;
  note: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  addresses: Address[];
};

export type CartItem = {
  id: string;
  kind: "menu" | "custom";
  key?: string;
  name: string;
  image?: string;
  qty: number;
  unitPrice: number;
  details?: CustomPizzaDetails | { size: SizeId; sizeName: string };
};

export type AppliedPromo = {
  code: string;
  label: string;
  pct: number;
  discount: number;
  freeDelivery: boolean;
};

export type Pricing = {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
};

export type OrderStatus = "placed" | "confirmed" | "baking" | "quality_check" | "out_for_delivery" | "delivered";

export type OrderItem = {
  type: "menu" | "custom";
  key?: string;
  name: string;
  image: string;
  qty: number;
  unitPrice: number;
  details?: any;
};

export type Order = {
  id: string;
  number: number;
  items: OrderItem[];
  address: Address;
  notes: string;
  paymentMethod: string;
  promo: { code: string; label: string } | null;
  pricing: Pricing;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  driver: { name: string; phone: string; vehicle: string } | null;
  etaMinutes: number;
  deliveredAt: string | null;
  createdAt: string;
};

export const STATUS_ORDER: OrderStatus[] = ["placed", "confirmed", "baking", "quality_check", "out_for_delivery", "delivered"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order placed",
  confirmed: "Order confirmed",
  baking: "In the wood-fired oven",
  quality_check: "Quality check",
  out_for_delivery: "On its way",
  delivered: "Delivered",
};

// Menu pizza size pricing (mirrors backend; server is authoritative).
export const SIZE_DELTAS: Record<SizeId, number> = { small: -3, medium: 0, large: 4 };
export const SIZE_LABEL: Record<SizeId, string> = { small: 'Personal 8"', medium: 'Classic 11"', large: 'Grande 14"' };

export const DELIVERY_FEE = 2.99;
export const FREE_DELIVERY_OVER = 30;
export const TAX_RATE = 0.05;

export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}
