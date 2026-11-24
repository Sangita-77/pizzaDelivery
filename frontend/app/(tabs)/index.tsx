import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, imageUrl } from "@/src/api";
import { useCart } from "@/src/cart";
import { MenuItemRow } from "@/src/components/MenuItemRow";
import { FavoritesRow } from "@/src/components/FavoritesRow";
import { useToast } from "@/src/components/Toast";
import { Chip, ErrorState, Loading, SectionTitle } from "@/src/components/ui";
import { tap } from "@/src/haptics";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import { money, SIZE_DELTAS, SIZE_LABEL, STATUS_LABEL, type MenuItem, type Order } from "@/src/types";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "pizza", label: "Pizzas" },
  { id: "sides", label: "Sides" },
  { id: "desserts", label: "Desserts" },
  { id: "drinks", label: "Drinks" },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const cart = useCart();
  const toast = useToast();
  const [category, setCategory] = useState("all");

  const menuQuery = useQuery({ queryKey: ["menu"], queryFn: () => api<{ items: MenuItem[] }>("/menu") });
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<{ orders: Order[] }>("/orders"),
    refetchInterval: 8000,
  });

  const activeOrder = ordersQuery.data?.orders?.find((o) => o.status !== "delivered" && o.status !== "cancelled");
  const items = useMemo(() => menuQuery.data?.items ?? [], [menuQuery.data]);
  const popular = useMemo(() => items.filter((i) => i.popular).slice(0, 6), [items]);
  const filtered = category === "all" ? items : items.filter((i) => i.category === category);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const quickAdd = (item: MenuItem) => {
    cart.addItem(
      {
        kind: "menu",
        key: item.key,
        name: item.name,
        image: item.image,
        unitPrice: Math.round((item.basePrice + SIZE_DELTAS.medium) * 100) / 100,
        details: item.hasSizes ? { size: "medium", sizeName: SIZE_LABEL.medium } : undefined,
      },
      1,
    );
    toast.show(`${item.name} added to cart`, "success");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.wordmark}>Fornello</Text>
          <Text style={styles.headerSub}>Wood-fired pizza, delivered</Text>
        </View>
        <Pressable
          onPress={() => router.push("/cart")}
          testID="home-cart-button"
          accessibilityRole="button"
          accessibilityLabel="Open cart"
          style={styles.cartButton}
          hitSlop={8}
        >
          <Ionicons name="cart" size={22} color={colors.onSurface} />
          {cart.count > 0 ? (
            <View style={styles.cartBadge} testID="home-cart-badge">
              <Text style={styles.cartBadgeText}>{cart.count}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {menuQuery.isLoading ? (
        <Loading label="Lighting the oven…" />
      ) : menuQuery.isError ? (
        <ErrorState message={(menuQuery.error as Error)?.message || "Could not load the menu"} onRetry={() => menuQuery.refetch()} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomChrome + 24 }}
        >
          {/* Active order banner */}
          {activeOrder ? (
            <Pressable
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: activeOrder.id } })}
              testID="home-active-order-banner"
              accessibilityRole="button"
              style={styles.activeBanner}
            >
              <View style={styles.activeBannerLeft}>
                <Text style={styles.activeBannerTitle} numberOfLines={1}>
                  Order #{activeOrder.number} · {STATUS_LABEL[activeOrder.status]}
                </Text>
                <Text style={styles.activeBannerSub}>Tap to track your order live</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onBrandPrimary} />
            </Pressable>
          ) : null}

          {/* Hero */}
          <View style={styles.hero}>
            <Image source={{ uri: imageUrl("/menu/wood-oven.jpg") }} style={styles.heroImage} contentFit="cover" transition={300} />
            <LinearGradient colors={["transparent", "rgba(31,26,23,0.85)"]} style={styles.heroScrim} />
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>Blistered crust. Pure fire.</Text>
              <Text style={styles.heroSub}>90 seconds in a oak-fired oven, at your door in 30.</Text>
              <Pressable
                onPress={() => router.push("/builder")}
                testID="home-build-pizza-button"
                accessibilityRole="button"
                style={styles.heroCta}
              >
                <Text style={styles.heroCtaText}>Build your pizza</Text>
              </Pressable>
            </View>
          </View>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                active={category === c.id}
                onPress={() => setCategory(c.id)}
                testID={`home-category-${c.id}`}
              />
            ))}
          </ScrollView>

          {/* Favourites */}
          {category === "all" ? <FavoritesRow /> : null}

          {/* Popular */}
          {category === "all" ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <SectionTitle>Popular this week</SectionTitle>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
                {popular.map((item) => (
                  <View key={item.key} style={styles.popularCard}>
                    <Pressable onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.key } })} testID={`home-popular-${item.key}`}>
                      <Image source={{ uri: imageUrl(item.image) }} style={styles.popularImage} contentFit="cover" transition={200} />
                      <Text style={styles.popularName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.popularPrice}>{money(item.basePrice)}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        tap();
                        quickAdd(item);
                      }}
                      testID={`home-popular-add-${item.key}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${item.name} to cart`}
                      style={styles.popularAdd}
                      hitSlop={4}
                    >
                      <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Menu list */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <SectionTitle>{category === "all" ? "The whole menu" : CATEGORIES.find((c) => c.id === category)?.label ?? ""}</SectionTitle>
            </View>
            <View style={styles.listGap}>
              {filtered.map((item) => (
                <MenuItemRow key={item.key} item={item} onAdd={quickAdd} onPress={(i) => router.push({ pathname: "/item/[id]", params: { id: i.key } })} />
              ))}
            </View>
          </View>
        </ScrollView>
      )}
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.onSurface,
  },
  headerSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  cartBadgeText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  activeBanner: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeBannerLeft: {
    flex: 1,
    gap: 2,
  },
  activeBannerTitle: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  activeBannerSub: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.body,
    fontSize: 12,
    opacity: 0.85,
  },
  hero: {
    marginHorizontal: 24,
    height: 210,
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  heroImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  heroScrim: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  heroContent: {
    padding: 20,
    gap: 8,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: "#FDFBF7",
  },
  heroSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: "rgba(253,251,247,0.85)",
  },
  heroCta: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 4,
  },
  heroCtaText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  chipRow: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
  },
  section: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  popularRow: {
    gap: 12,
    paddingRight: 24,
  },
  popularCard: {
    width: 200,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  popularImage: {
    width: "100%",
    height: 120,
    borderRadius: radius.md,
  },
  popularName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.onSurface,
    marginTop: 8,
  },
  popularPrice: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  popularAdd: {
    position: "absolute",
    right: 12,
    bottom: 10,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  listGap: {
    gap: 12,
  },
}));
