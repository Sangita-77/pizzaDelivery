import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useCart } from "@/src/cart";
import { MenuItemRow } from "@/src/components/MenuItemRow";
import { useToast } from "@/src/components/Toast";
import { Chip, ErrorState, Loading } from "@/src/components/ui";
import { tap } from "@/src/haptics";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import { SIZE_DELTAS, SIZE_LABEL, type MenuItem } from "@/src/types";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "pizza", label: "Pizzas" },
  { id: "sides", label: "Sides" },
  { id: "desserts", label: "Desserts" },
  { id: "drinks", label: "Drinks" },
];

export default function Menu() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const cart = useCart();
  const toast = useToast();

  const [category, setCategory] = useState("all");
  const [vegOnly, setVegOnly] = useState(false);
  const [search, setSearch] = useState("");

  const menuQuery = useQuery({ queryKey: ["menu"], queryFn: () => api<{ items: MenuItem[] }>("/menu") });
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const items = useMemo(() => {
    let list = menuQuery.data?.items ?? [];
    if (category !== "all") list = list.filter((i) => i.category === category);
    if (vegOnly) list = list.filter((i) => i.veg);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    return list;
  }, [menuQuery.data, category, vegOnly, search]);

  const quickAdd = (item: MenuItem) => {
    cart.addItem(
      {
        kind: "menu",
        key: item.key,
        name: item.name,
        image: item.image,
        unitPrice: Math.round((item.basePrice + SIZE_DELTAS.medium) * 100) / 100,
        details: { size: "medium", sizeName: SIZE_LABEL.medium },
      },
      1,
    );
    toast.show(`${item.name} added to cart`, "success");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Sticky chrome: title + search + chips (constant across list states) */}
      <View style={styles.header}>
        <Text style={styles.title}>Our Menu</Text>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search wood-fired favourites…"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            testID="menu-search-input"
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} testID="menu-search-clear" hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.label} active={category === c.id} onPress={() => setCategory(c.id)} testID={`menu-category-${c.id}`} />
          ))}
          <Chip label="Veg only" active={vegOnly} onPress={() => setVegOnly((v) => !v)} testID="menu-filter-veg" />
        </ScrollView>
      </View>

      {menuQuery.isLoading ? (
        <Loading label="Warming the oven…" />
      ) : menuQuery.isError ? (
        <ErrorState message={(menuQuery.error as Error)?.message || "Could not load the menu"} onRetry={() => menuQuery.refetch()} />
      ) : items.length === 0 ? (
        <View style={styles.empty} testID="menu-empty-state">
          <Ionicons name="pizza" size={40} color={colors.muted} />
          <Text style={styles.emptyTitle}>Nothing found</Text>
          <Text style={styles.emptySub}>Try a different search or clear your filters.</Text>
          <Pressable
            onPress={() => {
              setSearch("");
              setCategory("all");
              setVegOnly(false);
            }}
            testID="menu-empty-reset"
            style={styles.emptyReset}
            accessibilityRole="button"
          >
            <Text style={styles.emptyResetText}>Reset filters</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.key}
          contentContainerStyle={{ padding: 24, gap: 12, paddingBottom: bottomChrome + 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MenuItemRow
              item={item}
              onAdd={quickAdd}
              onPress={(i) => {
                tap();
                router.push({ pathname: "/item/[id]", params: { id: i.key } });
              }}
            />
          )}
        />
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.onSurface,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onSurface,
  },
  chipRow: {
    gap: 8,
    paddingRight: 24,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 32,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.onSurface,
  },
  emptySub: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
  },
  emptyReset: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  emptyResetText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
}));
