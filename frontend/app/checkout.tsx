import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useCart } from "@/src/cart";
import { useToast } from "@/src/components/Toast";
import { Field } from "@/src/components/ui";
import { success } from "@/src/haptics";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import { money, type Order } from "@/src/types";

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const cart = useCart();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(user?.addresses?.[0]?.id ?? null);
  const [showForm, setShowForm] = useState((user?.addresses?.length ?? 0) === 0);
  const [label, setLabel] = useState("Home");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user) {
      router.replace({ pathname: "/login", params: { redirect: "/checkout" } });
    }
  }, [user, router]);

  const placeOrder = useMutation({
    mutationFn: () => {
      const items = cart.items.map((i) =>
        i.kind === "menu"
          ? { type: "menu", key: i.key, qty: i.qty, size: (i.details as any)?.size ?? "medium" }
          : { type: "custom", qty: i.qty, details: i.details },
      );
      const useSaved = selectedId && !showForm;
      const body: any = {
        items,
        notes,
        promoCode: cart.promo?.code,
        ...(useSaved ? { addressId: selectedId } : { address: { label, line1, city, zip, note }, saveAddress: true }),
      };
      return api<{ order: Order }>("/orders", { method: "POST", json: body });
    },
    onSuccess: (res) => {
      success();
      toast.show("Order confirmed! The oven is heating up.", "success");
      cart.clear();
      refreshUser().catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.replace({ pathname: "/order/[id]", params: { id: res.order.id, new: "1" } });
    },
    onError: (e: any) => {
      toast.show(e?.message || "Could not place your order", "error");
    },
  });

  if (!user) return <View style={styles.screen} />;

  const submit = () => {
    if (cart.items.length === 0) {
      toast.show("Your cart is empty", "error");
      return;
    }
    if (!selectedId && !showForm) {
      toast.show("Please choose a delivery address", "error");
      return;
    }
    if (showForm && (!line1.trim() || !city.trim() || !zip.trim())) {
      toast.show("Please complete your delivery address", "error");
      return;
    }
    placeOrder.mutate();
  };

  return (
    <View style={styles.screen} testID="checkout-screen">
      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 140 }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="checkout-back-button" accessibilityRole="button" hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Checkout</Text>
        </View>

        {/* Addresses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery address</Text>
          {user.addresses.map((a) => {
            const active = selectedId === a.id && !showForm;
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  setSelectedId(a.id);
                  setShowForm(false);
                }}
                testID={`checkout-address-${a.id}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.addressCard, active && styles.addressCardActive]}
              >
                <View style={[styles.radioDot, active && styles.radioDotActive]}>{active ? <View style={styles.radioInner} /> : null}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>
                    {a.label} · {a.line1}
                  </Text>
                  <Text style={styles.addressSub}>
                    {a.city} {a.zip}
                  </Text>
                </View>
                <Ionicons name="location" size={18} color={colors.brandPrimary} />
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => {
              setShowForm((v) => !v);
              if (!showForm && user.addresses[0]) setSelectedId(user.addresses[0].id);
            }}
            testID="checkout-add-address-toggle"
            accessibilityRole="button"
            style={styles.addAddressToggle}
          >
            <Ionicons name={showForm ? "close" : "add"} size={16} color={colors.brandSecondary} />
            <Text style={styles.addAddressText}>{showForm ? "Hide new address" : "Add a new address"}</Text>
          </Pressable>

          {showForm ? (
            <View style={styles.form}>
              <Field label="Label" testID="checkout-address-label" value={label} onChangeText={setLabel} placeholder="Home, Work…" />
              <Field label="Street address" testID="checkout-address-line1" value={line1} onChangeText={setLine1} placeholder="24 Ember Lane" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="City" testID="checkout-address-city" value={city} onChangeText={setCity} placeholder="Naples" />
                </View>
                <View style={{ width: 110 }}>
                  <Field label="ZIP" testID="checkout-address-zip" value={zip} onChangeText={setZip} placeholder="90210" keyboardType="numbers-and-punctuation" />
                </View>
              </View>
              <Field label="Delivery note (optional)" testID="checkout-address-note" value={note} onChangeText={setNote} placeholder="Ring the bell twice" />
            </View>
          ) : null}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order notes</Text>
          <Field label="Anything we should know?" testID="checkout-notes-input" value={notes} onChangeText={setNotes} placeholder="Extra crispy crust, please" multiline />
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={[styles.codCard, styles.addressCardActive]} testID="checkout-cod-card">
            <View style={[styles.radioDot, styles.radioDotActive]}>
              <View style={styles.radioInner} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>Cash on Delivery</Text>
              <Text style={styles.addressSub}>Pay our driver when your pizza arrives</Text>
            </View>
            <Ionicons name="cash" size={20} color={colors.brandPrimary} />
          </View>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order summary</Text>
          <View style={styles.totalsCard} testID="checkout-totals">
            {cart.items.map((i) => (
              <View key={i.id} style={styles.totalRow}>
                <Text style={styles.totalLabel} numberOfLines={1}>
                  {i.qty}× {i.name}
                </Text>
                <Text style={styles.totalValue}>{money(i.unitPrice * i.qty)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{money(cart.totals.subtotal)}</Text>
            </View>
            {cart.totals.discount > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Promo ({cart.promo?.code})</Text>
                <Text style={[styles.totalValue, { color: colors.success }]}>−{money(cart.totals.discount)}</Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery</Text>
              <Text style={[styles.totalValue, cart.totals.deliveryFee === 0 ? { color: colors.success } : null]}>
                {cart.totals.deliveryFee === 0 ? "FREE" : money(cart.totals.deliveryFee)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax (5%)</Text>
              <Text style={styles.totalValue}>{money(cart.totals.tax)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalBold}>Total</Text>
              <Text style={styles.totalBold} testID="checkout-total">
                {money(cart.totals.total)}
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stickyLabel}>Cash on delivery</Text>
          <Text style={styles.stickyTotal}>{money(cart.totals.total)}</Text>
        </View>
        <Pressable
          onPress={submit}
          disabled={placeOrder.isPending}
          testID="checkout-place-order-button"
          accessibilityRole="button"
          style={[styles.placeBtn, placeOrder.isPending && { opacity: 0.7 }]}
        >
          <Text style={styles.placeBtnText}>{placeOrder.isPending ? "Placing order…" : "Place order"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.onSurface,
  },
  section: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.onSurface,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 14,
  },
  addressCardActive: {
    borderColor: colors.brandPrimary,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 1.6,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotActive: {
    borderColor: colors.brandPrimary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  addressLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.onSurface,
  },
  addressSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  addAddressToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.2,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  addAddressText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.brandSecondary,
  },
  form: {
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  codCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.2,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: 14,
  },
  totalsCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  totalLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  totalValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.onSurface,
  },
  totalBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.onSurface,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  stickyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stickyLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  stickyTotal: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.onSurface,
  },
  placeBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  placeBtnText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
}));
