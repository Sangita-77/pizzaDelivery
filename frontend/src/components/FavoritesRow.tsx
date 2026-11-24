import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";

import { imageUrl } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useCart } from "@/src/cart";
import { useToast } from "@/src/components/Toast";
import { success } from "@/src/haptics";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import { money, type Favorite } from "@/src/types";

export function favoriteSubtitle(f: Favorite): string {
  const d = f.details;
  if (!d) return "";
  if (f.kind === "menu") return d.sizeName ?? "";
  const n = d.toppings?.length ?? 0;
  return `${n} topping${n === 1 ? "" : "s"}`;
}

// Adds a saved favourite straight to the cart (one tap).
export function useAddFavoriteToCart() {
  const cart = useCart();
  const toast = useToast();
  return (f: Favorite) => {
    cart.addItem({ kind: f.kind, key: f.key || undefined, name: f.name, image: f.image, unitPrice: f.unitPrice, details: f.details ?? undefined }, 1);
    success();
    toast.show(`${f.name} added to cart`, "success");
  };
}

// Horizontal "Your favourites" row for the Home screen.
export function FavoritesRow() {
  const { user } = useAuth();
  const styles = useStyles();
  const { colors } = useTheme();
  const addToCart = useAddFavoriteToCart();
  const favorites = user?.favorites ?? [];
  if (!favorites.length) return null;

  return (
    <View style={styles.section} testID="home-favorites">
      <Text style={styles.title}>Your favourites</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {favorites.map((f) => (
          <View key={f.id} style={styles.card} testID={`home-favorite-${f.id}`}>
            {f.image ? (
              <Image source={{ uri: imageUrl(f.image) }} style={styles.image} contentFit="cover" transition={200} />
            ) : (
              <View style={[styles.image, styles.placeholder]}>
                <Ionicons name="construct" size={18} color={colors.brandPrimary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {f.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {favoriteSubtitle(f)} · {money(f.unitPrice)}
              </Text>
            </View>
            <Pressable
              onPress={() => addToCart(f)}
              testID={`home-favorite-add-${f.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Add ${f.name} to cart`}
              style={styles.add}
            >
              <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  section: { gap: 12, marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface, paddingHorizontal: 24 },
  row: { gap: 12, paddingHorizontal: 24 },
  card: {
    width: 250,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: 10,
  },
  image: { width: 52, height: 52, borderRadius: radius.md },
  placeholder: { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onSurface },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.onSurfaceSecondary },
  add: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
