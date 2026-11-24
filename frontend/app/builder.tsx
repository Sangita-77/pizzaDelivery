import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useCart } from "@/src/cart";
import { useToast } from "@/src/components/Toast";
import { Chip, ErrorState, Loading } from "@/src/components/ui";
import { success } from "@/src/haptics";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import { money, type BuilderConfig, type SizeId } from "@/src/types";

export default function Builder() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const cart = useCart();
  const toast = useToast();

  const configQuery = useQuery({ queryKey: ["builder-config"], queryFn: () => api<BuilderConfig>("/builder-config") });
  const config = configQuery.data;

  const [size, setSize] = useState<SizeId>("medium");
  const [crust, setCrust] = useState("hand_tossed");
  const [sauce, setSauce] = useState("tomato");
  const [cheese, setCheese] = useState("fior");
  const [toppings, setToppings] = useState<string[]>([]);
  const [favSaving, setFavSaving] = useState(false);
  const { user, addFavorite, removeFavorite } = useAuth();

  const price = useMemo(() => {
    if (!config) return 0;
    const s = config.sizes.find((x) => x.id === size)?.delta ?? 0;
    const c = config.crusts.find((x) => x.id === crust)?.delta ?? 0;
    const sa = config.sauces.find((x) => x.id === sauce)?.delta ?? 0;
    const ch = config.cheeses.find((x) => x.id === cheese)?.delta ?? 0;
    const t = toppings.reduce((sum, id) => sum + (config.toppings.find((x) => x.id === id)?.delta ?? 0), 0);
    return Math.round((config.basePrice + s + c + sa + ch + t) * 100) / 100;
  }, [config, size, crust, sauce, cheese, toppings]);

  if (configQuery.isLoading || !config) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Loading label="Rolling out the dough…" />
      </View>
    );
  }
  if (configQuery.isError) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ErrorState message="Could not load the builder." onRetry={() => configQuery.refetch()} />
      </View>
    );
  }

  const toggleTopping = (id: string) => setToppings((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const sizeName = config.sizes.find((s) => s.id === size)?.name ?? "";
  const details = { size, crust, sauce, cheese, toppings };
  const favMatch = user?.favorites?.find((f) => f.kind === "custom" && JSON.stringify(f.details) === JSON.stringify(details));

  const toggleFavorite = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (favSaving) return;
    setFavSaving(true);
    try {
      if (favMatch) {
        await removeFavorite(favMatch.id);
        toast.show("Removed from favourites");
      } else {
        await addFavorite({ kind: "custom", name: `Build-Your-Own • ${sizeName}`, image: "", unitPrice: price, details });
        toast.show("Your creation is saved to favourites", "success");
      }
    } catch (e: any) {
      toast.show(e?.message || "Could not update favourites", "error");
    } finally {
      setFavSaving(false);
    }
  };

  const addToCart = () => {
    const sizeName = config.sizes.find((s) => s.id === size)?.name ?? "";
    cart.addItem({ kind: "custom", name: `Build-Your-Own • ${sizeName}`, unitPrice: price, details: { size, crust, sauce, cheese, toppings } });
    success();
    toast.show("Your creation added to cart", "success");
    router.back();
  };

  const RadioRow = ({ active, name, delta, onPress, testID }: { active: boolean; name: string; delta: number; onPress: () => void; testID: string }) => (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="radio" accessibilityState={{ selected: active }} style={[styles.radioRow, active && styles.radioRowActive]}>
      <View style={[styles.radioDot, active && styles.radioDotActive]}>
        {active ? <View style={styles.radioInner} /> : null}
      </View>
      <Text style={[styles.radioName, active && { color: colors.brandSecondary }]}>{name}</Text>
      <Text style={styles.radioDelta}>{delta === 0 ? "Included" : `+${money(delta)}`}</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen} testID="builder-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 140 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="builder-back-button" accessibilityRole="button" hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Build your pizza</Text>
            <Text style={styles.subtitle}>Choose every layer, we fire it in 90 seconds.</Text>
          </View>
          <Pressable
            onPress={toggleFavorite}
            testID="builder-favorite-button"
            accessibilityRole="button"
            accessibilityLabel={favMatch ? "Remove this build from favourites" : "Save this build to favourites"}
            accessibilityState={{ selected: !!favMatch }}
            style={styles.backBtn}
          >
            <Ionicons name={favMatch ? "heart" : "heart-outline"} size={20} color={favMatch ? colors.brandPrimary : colors.onSurface} />
          </Pressable>
        </View>

        {/* Size */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1 · Size</Text>
          <View style={styles.chipWrap}>
            {config.sizes.map((s) => (
              <Chip key={s.id} label={`${s.name}${s.delta ? ` +${money(s.delta)}` : ""}`} active={size === s.id} onPress={() => setSize(s.id as SizeId)} testID={`builder-size-${s.id}`} />
            ))}
          </View>
        </View>

        {/* Crust */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2 · Crust</Text>
          <View style={{ gap: 8 }}>
            {config.crusts.map((c) => (
              <RadioRow key={c.id} active={crust === c.id} name={c.name} delta={c.delta} onPress={() => setCrust(c.id)} testID={`builder-crust-${c.id}`} />
            ))}
          </View>
        </View>

        {/* Sauce */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3 · Sauce</Text>
          <View style={{ gap: 8 }}>
            {config.sauces.map((s) => (
              <RadioRow key={s.id} active={sauce === s.id} name={s.name} delta={s.delta} onPress={() => setSauce(s.id)} testID={`builder-sauce-${s.id}`} />
            ))}
          </View>
        </View>

        {/* Cheese */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4 · Cheese</Text>
          <View style={{ gap: 8 }}>
            {config.cheeses.map((c) => (
              <RadioRow key={c.id} active={cheese === c.id} name={c.name} delta={c.delta} onPress={() => setCheese(c.id)} testID={`builder-cheese-${c.id}`} />
            ))}
          </View>
        </View>

        {/* Toppings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5 · Toppings</Text>
          <Text style={styles.sectionHint}>Pick as many as you like</Text>
          <View style={styles.toppingGrid}>
            {config.toppings.map((t) => {
              const active = toppings.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => toggleTopping(t.id)}
                  testID={`builder-topping-${t.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.topping, active && styles.toppingActive]}
                >
                  <View style={[styles.toppingVeg, { borderColor: t.veg ? colors.success : colors.error }]}>
                    <View style={[styles.toppingVegDot, { backgroundColor: t.veg ? colors.success : colors.error }]} />
                  </View>
                  <Text style={[styles.toppingName, active && { color: colors.onBrandPrimary }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={[styles.toppingDelta, active && { color: colors.onBrandPrimary }]}>+{money(t.delta)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky summary bar */}
      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stickyLabel}>Your creation</Text>
          <Text style={styles.stickyPrice}>{money(price)}</Text>
        </View>
        <Pressable onPress={addToCart} testID="builder-add-to-cart-button" accessibilityRole="button" style={styles.addBar}>
          <Text style={styles.addBarText}>Add to cart</Text>
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
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
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
  sectionHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: -6,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 14,
  },
  radioRowActive: {
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
  radioName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.onSurface,
  },
  radioDelta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
  },
  toppingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  topping: {
    width: "47.5%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  toppingActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimary,
  },
  toppingVeg: {
    width: 13,
    height: 13,
    borderWidth: 1.2,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  toppingVegDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  toppingName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.onSurface,
  },
  toppingDelta: {
    fontFamily: fonts.body,
    fontSize: 10,
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
  stickyLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  stickyPrice: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.onSurface,
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
