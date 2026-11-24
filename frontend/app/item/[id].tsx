import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, imageUrl } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useCart } from "@/src/cart";
import { useToast } from "@/src/components/Toast";
import { ErrorState, Loading, Stepper } from "@/src/components/ui";
import { success, tap } from "@/src/haptics";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import { money, SIZE_DELTAS, SIZE_LABEL, type MenuItem, type SizeId } from "@/src/types";

const SIZES: { id: SizeId; label: string; hint: string }[] = [
  { id: "small", label: SIZE_LABEL.small, hint: "Serves 1" },
  { id: "medium", label: SIZE_LABEL.medium, hint: "Serves 2" },
  { id: "large", label: SIZE_LABEL.large, hint: "Serves 3–4" },
];

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const cart = useCart();
  const toast = useToast();

  const menuQuery = useQuery({ queryKey: ["menu"], queryFn: () => api<{ items: MenuItem[] }>("/menu") });
  const item = menuQuery.data?.items?.find((i) => i.key === id);

  const [size, setSize] = useState<SizeId>("medium");
  const [qty, setQty] = useState(1);
  const [favSaving, setFavSaving] = useState(false);
  const { user, addFavorite, removeFavorite } = useAuth();

  if (menuQuery.isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Loading label="Plating…" />
      </View>
    );
  }
  if (!item) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ErrorState message="This item is no longer on the menu." onRetry={() => router.back()} />
      </View>
    );
  }

  const unitPrice = item.hasSizes ? Math.round((item.basePrice + SIZE_DELTAS[size]) * 100) / 100 : item.basePrice;
  const favMatch = user?.favorites?.find(
    (f) => f.kind === "menu" && f.key === item.key && (f.details?.size ?? null) === (item.hasSizes ? size : null),
  );

  const toggleFavorite = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (favSaving) return;
    tap();
    setFavSaving(true);
    try {
      if (favMatch) {
        await removeFavorite(favMatch.id);
        toast.show("Removed from favourites");
      } else {
        await addFavorite({
          kind: "menu",
          key: item.key,
          name: item.name,
          image: item.image,
          unitPrice,
          details: item.hasSizes ? { size, sizeName: SIZE_LABEL[size] } : null,
        });
        toast.show("Saved to favourites", "success");
      }
    } catch (e: any) {
      toast.show(e?.message || "Could not update favourites", "error");
    } finally {
      setFavSaving(false);
    }
  };

  const addToCart = () => {
    cart.addItem(
      {
        kind: "menu",
        key: item.key,
        name: item.name,
        image: item.image,
        unitPrice,
        details: item.hasSizes ? { size, sizeName: SIZE_LABEL[size] } : undefined,
      },
      qty,
    );
    success();
    toast.show(`${qty}× ${item.name} added to cart`, "success");
    router.back();
  };

  return (
    <View style={styles.screen} testID="item-detail-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}>
        <View>
          {item.image ? (
            <Image source={{ uri: imageUrl(item.image) }} style={styles.heroImage} contentFit="cover" transition={300} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Ionicons name="flame" size={48} color={colors.brandPrimary} />
            </View>
          )}
          <Pressable
            onPress={() => router.back()}
            testID="item-back-button"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[styles.backButton, { top: insets.top + 12 }]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <Pressable
            onPress={toggleFavorite}
            testID="item-favorite-button"
            accessibilityRole="button"
            accessibilityLabel={favMatch ? "Remove from favourites" : "Save to favourites"}
            accessibilityState={{ selected: !!favMatch }}
            style={[styles.backButton, styles.favButton, { top: insets.top + 12 }]}
          >
            <Ionicons name={favMatch ? "heart" : "heart-outline"} size={20} color={favMatch ? colors.brandPrimary : colors.onSurface} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <View style={[styles.vegBadge, { borderColor: item.veg ? colors.success : colors.error }]}>
              <View style={[styles.vegDot, { backgroundColor: item.veg ? colors.success : colors.error }]} />
            </View>
            {item.spicy ? (
              <View style={styles.spicyBadge}>
                <Ionicons name="flame" size={11} color={colors.brandSecondary} />
                <Text style={styles.spicyText}>Spicy</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.description}>{item.description}</Text>

          {item.hasSizes ? (
            <View style={{ gap: 10, marginTop: 8 }}>
              <Text style={styles.sectionLabel}>Choose your size</Text>
              <View style={styles.sizeRow}>
                {SIZES.map((s) => {
                  const active = size === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => {
                        tap();
                        setSize(s.id);
                      }}
                      testID={`item-size-${s.id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.sizeCard, active && styles.sizeCardActive]}
                    >
                      <Text style={[styles.sizeLabel, active && { color: colors.onBrandPrimary }]}>{s.label}</Text>
                      <Text style={[styles.sizeHint, active && { color: colors.onBrandPrimary, opacity: 0.8 }]}>
                        {s.hint} · {money(Math.round((item.basePrice + SIZE_DELTAS[s.id]) * 100) / 100)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky add bar */}
      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.stickyLeft}>
          <Stepper value={qty} onInc={() => setQty((q) => Math.min(20, q + 1))} onDec={() => setQty((q) => Math.max(1, q - 1))} testIDPrefix="item-qty" />
        </View>
        <Pressable onPress={addToCart} testID="item-add-to-cart-button" accessibilityRole="button" style={styles.addBar}>
          <Text style={styles.addBarText}>
            Add · {money(unitPrice * qty)}
          </Text>
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
  heroImage: {
    width: "100%",
    height: 320,
  },
  heroPlaceholder: {
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: "rgba(253,251,247,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  favButton: {
    left: undefined,
    right: 16,
  },
  body: {
    padding: 24,
    gap: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vegBadge: {
    width: 18,
    height: 18,
    borderWidth: 1.4,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  spicyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  spicyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.brandSecondary,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.onSurface,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.onSurfaceSecondary,
  },
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.onSurface,
  },
  sizeRow: {
    flexDirection: "row",
    gap: 10,
  },
  sizeCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1.4,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    padding: 12,
    gap: 3,
  },
  sizeCardActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimary,
  },
  sizeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.onSurface,
  },
  sizeHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
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
  stickyLeft: {
    flex: 0,
  },
  addBar: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  addBarText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
}));
