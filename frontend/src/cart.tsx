import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { api } from "@/src/api";
import { storage } from "@/src/utils/storage";
import {
  DELIVERY_FEE,
  FREE_DELIVERY_OVER,
  TAX_RATE,
  type AppliedPromo,
  type CartItem,
  type Pricing,
} from "@/src/types";

const CART_KEY = "cart_items_v1";
const PROMO_KEY = "cart_promo_v1";

type CartContextValue = {
  items: CartItem[];
  promo: AppliedPromo | null;
  ready: boolean;
  count: number;
  totals: Pricing;
  addItem: (item: Omit<CartItem, "id" | "qty">, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  applyPromo: (code: string, subtotal: number) => Promise<void>;
  removePromo: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export function computeTotals(items: CartItem[], promo: AppliedPromo | null): Pricing {
  const subtotal = Math.round(items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0) * 100) / 100;
  const discount = promo?.pct ? Math.round(((subtotal * promo.pct) / 100) * 100) / 100 : 0;
  const deliveryFee = !items.length ? 0 : promo?.freeDelivery || subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
  const taxable = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const tax = Math.round(taxable * TAX_RATE * 100) / 100;
  const total = Math.round((taxable + deliveryFee + tax) * 100) / 100;
  return { subtotal, discount, deliveryFee, tax, total };
}

export function CartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem(CART_KEY, "");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setItems(parsed);
        } catch {}
      }
      const rawPromo = await storage.getItem(PROMO_KEY, "");
      if (rawPromo) {
        try {
          const parsed = JSON.parse(rawPromo);
          if (parsed && parsed.code) setPromo(parsed);
        } catch {}
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    storage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, ready]);

  useEffect(() => {
    if (!ready) return;
    storage.setItem(PROMO_KEY, JSON.stringify(promo));
  }, [promo, ready]);

  const addItem = useCallback((item: Omit<CartItem, "id" | "qty">, qty = 1) => {
    setItems((prev) => {
      // Merge identical items (same kind/key/details) into one line.
      const fingerprint = JSON.stringify([item.kind, item.key ?? "", item.name, item.unitPrice, item.details ?? null]);
      const existing = prev.find((i) => JSON.stringify([i.kind, i.key ?? "", i.name, i.unitPrice, i.details ?? null]) === fingerprint);
      if (existing) {
        return prev.map((i) => (i.id === existing.id ? { ...i, qty: Math.min(20, i.qty + qty) } : i));
      }
      return [...prev, { ...item, id: Math.random().toString(36).slice(2) + Date.now().toString(36), qty }];
    });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty: Math.min(20, qty) } : i))));
  }, []);

  const removeItem = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);

  const clear = useCallback(() => {
    setItems([]);
    setPromo(null);
  }, []);

  const applyPromo = useCallback(async (code: string, subtotal: number) => {
    const res = await api<AppliedPromo>("/promo/validate", { method: "POST", json: { code, subtotal } });
    setPromo(res);
  }, []);

  const removePromo = useCallback(() => setPromo(null), []);

  const totals = useMemo(() => computeTotals(items, promo), [items, promo]);
  const count = useMemo(() => items.reduce((n, i) => n + i.qty, 0), [items]);

  const value = useMemo(
    () => ({ items, promo, ready, count, totals, addItem, setQty, removeItem, clear, applyPromo, removePromo }),
    [items, promo, ready, count, totals, addItem, setQty, removeItem, clear, applyPromo, removePromo],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
