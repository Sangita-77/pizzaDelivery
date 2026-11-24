import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";

import { imageUrl } from "@/src/api";
import { tap } from "@/src/haptics";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import { money, SIZE_LABEL, type MenuItem, type SizeId } from "@/src/types";

// Editorial menu row used on Home and Menu screens.
export function MenuItemRow({
  item,
  onAdd,
  onPress,
}: {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
  onPress: (item: MenuItem) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.card}>
    <Pressable
      onPress={() => onPress(item)}
      testID={`menu-item-${item.key}`}
      accessibilityRole="button"
      style={({ pressed }) => [styles.cardPress, pressed && { opacity: 0.85 }]}
    >
      {item.image ? (
        <Image source={{ uri: imageUrl(item.image) }} style={styles.image} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Ionicons name="flame" size={26} color={colors.brandPrimary} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <View style={styles.vegBadge}>{item.veg ? <Ionicons name="leaf" size={11} color={colors.success} /> : <Ionicons name="flame" size={11} color={colors.error} />}</View>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.footer}>
          <View>
            <Text style={styles.price}>{money(item.basePrice)}</Text>
            {item.hasSizes ? <Text style={styles.sizeHint}>{SIZE_LABEL.medium}</Text> : null}
          </View>
        </View>
      </View>
    </Pressable>
          <Pressable
            onPress={() => {
              tap();
              onAdd(item);
            }}
            testID={`menu-add-${item.key}`}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name} to cart`}
            style={styles.addButton}
          >
            <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
          </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPress: {
    flexDirection: "row",
    gap: 14,
    padding: 12,
    paddingRight: 64,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
  },
  imagePlaceholder: {
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vegBadge: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.onSurface,
    flexShrink: 1,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 2,
  },
  price: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.onSurface,
  },
  sizeHint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.muted,
  },
  addButton: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
}));
