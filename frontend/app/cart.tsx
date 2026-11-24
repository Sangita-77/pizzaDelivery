import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { imageUrl } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useCart } from "@/src/cart";
import { useToast } from "@/src/components/Toast";
import { EmptyState, ErrorState, Loading, Stepper } from "@/src/components/ui";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import { money, SIZE_LABEL, type AppliedPromo } from "@/src/types";

export default function Cart() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const cart = useCart();
  const toast = useToast();
  const { user } = useAuth();

  const [promoInput, setPromoInput] = useState("");
  const [applying, setApplying] = useState(false);

  if (!cart.ready) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Loading />
      </View>
    );
  }

  const applyPromo = async () => {
    if (applying || !promoInput.trim()) return;
    setApplying(true);
    try {
      await cart.applyPromo(promoInput.trim(), cart.totals.subtotal);
      toast.show("Promo applied", "success");
      setPromoInput("");
    } catch (e: any) {
      toast.show(e?.message || "Invalid promo code", "error");
    } finally {
      setApplying(false);
    }
  };

  const onCheckout = () => {
    if (!user) {
      router.push({ pathname: "/login", params: { redirect: "/checkout" } });
      return;
    }
    router.push("/checkout");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="cart-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="cart-back-button" accessibilityRole="button" hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Your cart</Text>
        {cart.count > 0 ? <Text style={styles.count}>{cart.count} item{cart.count > 1 ? "s" : ""}</Text> : null}
      </View>

      {cart.items.length === 0 ? (
        <EmptyState
          title="Your oven is cold!"
          subtitle="Add a delicious artisan pizza to begin."
          actionLabel="Browse the menu"
          onAction={() => router.push("/(tabs)/menu")}
          testID="cart-empty-state"
        />
      ) : (
        <View style={{ flex: 1 }}>
          {renderList()}
          <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stickyLabel}>Total (incl. tax & delivery)</Text>
              <Text style={styles.stickyTotal}>{money(cart.totals.total)}</Text>
            </View>
            <Pressable onPress={onCheckout} testID="cart-checkout-button" accessibilityRole="button" style={styles.checkoutBtn}>
              <Text style={styles.checkoutText}>Go to checkout</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  function renderList() {
    return (
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 24, paddingTop: 16, paddingBottom: insets.bottom + 110 }}
        bottomOffset={110}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="cart-list"
      >
        {cart.items.map((item) => (
          <View key={item.id} style={styles.itemCard} testID={`cart-item-${item.id}`}>
            {item.image ? (
              <Image source={{ uri: imageUrl(item.image) }} style={styles.itemImage} contentFit="cover" transition={200} />
            ) : (
              <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                <Ionicons name="flame" size={22} color={colors.brandPrimary} />
              </View>
            )}
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.details ? <Text style={styles.itemDetails} numberOfLines={2}>{detailsLine(item)}</Text> : null}
              <Text style={styles.itemPrice}>{money(item.unitPrice)}</Text>
            </View>
            <View style={{ gap: 8, alignItems: "flex-end" }}>
              <Stepper value={item.qty} onInc={() => cart.setQty(item.id, item.qty + 1)} onDec={() => cart.setQty(item.id, item.qty - 1)} testIDPrefix={`cart-qty-${item.id}`} />
              <Pressable onPress={() => cart.removeItem(item.id)} testID={`cart-remove-${item.id}`} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </Pressable>
            </View>
          </View>
        ))}

        {/* Promo */}
        <View style={styles.promoCard}>
          <Text style={styles.promoTitle}>Promo code</Text>
          {cart.promo ? (
            <View style={styles.promoApplied}>
              <View style={{ flex: 1 }}>
                <Text style={styles.promoCode}>{cart.promo.code}</Text>
                <Text style={styles.promoLabel}>{cart.promo.label}</Text>
              </View>
              <Pressable onPress={cart.removePromo} testID="cart-promo-remove" accessibilityRole="button" hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.error} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.promoRow}>
              <View style={styles.promoInputWrap}>
                <TextInput
                  style={styles.promoInputText}
                  value={promoInput}
                  onChangeText={(t) => setPromoInput(t.toUpperCase())}
                  placeholder="Enter code"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={applyPromo}
                  testID="cart-promo-input"
                />
                {promoInput ? (
                  <Pressable onPress={() => setPromoInput("")} hitSlop={6}>
                    <Ionicons name="close" size={16} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={applyPromo} disabled={applying} testID="cart-promo-apply" accessibilityRole="button" style={styles.promoApply}>
                <Text style={styles.promoApplyText}>{applying ? "Checking…" : "Apply"}</Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.promoHint}>Try WELCOME10 or FREEDEL</Text>
        </View>

        {/* Totals */}
        <View style={styles.totalsCard} testID="cart-totals">
          <Row label="Subtotal" value={money(cart.totals.subtotal)} />
          {cart.totals.discount > 0 ? <Row label="Promo discount" value={`−${money(cart.totals.discount)}`} accent={colors.success} testID="cart-discount" /> : null}
          <Row label="Delivery" value={cart.totals.deliveryFee === 0 ? "FREE" : money(cart.totals.deliveryFee)} accent={cart.totals.deliveryFee === 0 ? colors.success : undefined} />
          <Row label="Tax (5%)" value={money(cart.totals.tax)} />
          <View style={styles.divider} />
          <Row label="Total" value={money(cart.totals.total)} bold testID="cart-total" />
        </View>
      </KeyboardAwareScrollView>
    );
  }
}

function detailsLine(item: { details?: any }): string {
  const d = item.details;
  if (!d) return "";
  if (d.sizeName) return d.sizeName;
  const parts = [d.crust, d.sauce, d.cheese].filter(Boolean);
  return `${parts.join(" · ")}${d.toppings?.length ? ` · ${d.toppings.length} topping${d.toppings.length > 1 ? "s" : ""}` : ""}`;
}

function Row({ label, value, bold, accent, testID }: { label: string; value: string; bold?: boolean; accent?: string; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, bold && styles.totalBold]}>{label}</Text>
      <Text style={[styles.totalValue, bold && styles.totalBold, accent ? { color: accent } : null]} testID={testID}>
        {value}
      </Text>
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
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.onSurface,
  },
  count: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
  },
  itemCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  itemImagePlaceholder: {
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.onSurface,
  },
  itemDetails: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    lineHeight: 15,
  },
  itemPrice: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  promoCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
  },
  promoTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.onSurface,
  },
  promoRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  promoInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 46,
  },
  promoInputText: {
    flex: 1,
    height: "100%",
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.onSurface,
    letterSpacing: 1,
  },
  promoApply: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  promoApplyText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  promoApplied: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    padding: 12,
  },
  promoCode: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.onSurface,
  },
  promoLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.success,
  },
  promoHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
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
  },
  totalLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onSurfaceSecondary,
  },
  totalValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
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
  checkoutBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  checkoutText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
}));
