import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useCart } from "@/src/cart";
import { useToast } from "@/src/components/Toast";
import { EmptyState, ErrorState, Loading } from "@/src/components/ui";
import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import { money, STATUS_LABEL, type Order, type OrderStatus } from "@/src/types";

function statusTone(status: OrderStatus, colors: any): { bg: string; fg: string } {
  switch (status) {
    case "confirmed":
      return { bg: colors.info, fg: colors.onInfo };
    case "baking":
    case "quality_check":
      return { bg: colors.warning, fg: colors.onWarning };
    case "out_for_delivery":
      return { bg: colors.brandPrimary, fg: colors.onBrandPrimary };
    case "delivered":
      return { bg: colors.success, fg: colors.onSuccess };
    default:
      return { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary };
  }
}

export default function Orders() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const cart = useCart();
  const toast = useToast();
  const { user } = useAuth();

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<{ orders: Order[] }>("/orders"),
    enabled: !!user,
    refetchInterval: 8000,
  });

  const orders = useMemo(() => ordersQuery.data?.orders ?? [], [ordersQuery.data]);
  const active = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  const past = orders.filter((o) => o.status === "delivered" || o.status === "cancelled");
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const reorder = (order: Order) => {
    order.items.forEach((i) => {
      cart.addItem(
        {
          kind: i.type,
          key: i.key,
          name: i.name,
          image: i.image,
          unitPrice: i.unitPrice,
          details: i.details,
        },
        i.qty,
      );
    });
    toast.show("Previous order added to your cart", "success");
    router.push("/cart");
  };

  const summary = (order: Order) => order.items.map((i) => `${i.qty}× ${i.name}`).join(", ");

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
      </View>

      {ordersQuery.isLoading ? (
        <Loading label="Loading your orders…" />
      ) : ordersQuery.isError ? (
        <ErrorState message={(ordersQuery.error as Error)?.message || "Could not load orders"} onRetry={() => ordersQuery.refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          subtitle="Your artisan journey starts with the first wood-fired pie."
          actionLabel="Browse the menu"
          onAction={() => router.push("/(tabs)/menu")}
          testID="orders-empty-state"
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: bottomChrome + 24 }}>
          {active.length > 0 ? (
            <View style={{ gap: 12 }}>
              <Text style={styles.sectionLabel}>In the works</Text>
              {active.map((order) => {
                const tone = statusTone(order.status, colors);
                return (
                  <Pressable
                    key={order.id}
                    onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })}
                    testID={`orders-active-${order.id}`}
                    accessibilityRole="button"
                    style={styles.card}
                  >
                    <View style={styles.cardTop}>
                      <Text style={styles.cardNumber}>Order #{order.number}</Text>
                      <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.pillText, { color: tone.fg }]} testID={`orders-status-${order.id}`}>
                          {STATUS_LABEL[order.status]}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardSummary} numberOfLines={2}>
                      {summary(order)}
                    </Text>
                    <View style={styles.cardFooter}>
                      <Text style={styles.cardTotal}>{money(order.pricing.total)}</Text>
                      <View style={styles.trackBtn}>
                        <Text style={styles.trackText}>Track order</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.onBrandPrimary} />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {past.length > 0 ? (
            <View style={{ gap: 12 }}>
              <Text style={styles.sectionLabel}>Past orders</Text>
              {past.map((order) => (
                <View key={order.id} style={[styles.card, styles.pastCard]} testID={`orders-past-${order.id}`}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardNumber}>Order #{order.number}</Text>
                    <Text style={styles.cardDate}>{dayjs(order.createdAt).format("MMM D, h:mm A")}</Text>
                  </View>
                  <Text style={styles.cardSummary} numberOfLines={2}>
                    {summary(order)}
                  </Text>
                  {order.status === "cancelled" ? (
                    <Text style={[styles.statusNote, { color: colors.error }]} testID={`orders-cancelled-${order.id}`}>
                      Cancelled · {order.cancelReason || "The restaurant couldn't take this order"}
                    </Text>
                  ) : order.rating ? (
                    <Text style={[styles.statusNote, { color: colors.warning }]} testID={`orders-rating-${order.id}`}>
                      {"★".repeat(order.rating.stars)}
                      {"☆".repeat(5 - order.rating.stars)} You rated this order
                    </Text>
                  ) : (
                    <Pressable
                      onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })}
                      testID={`orders-rate-${order.id}`}
                      accessibilityRole="button"
                      style={styles.rateBtn}
                    >
                      <Ionicons name="star-outline" size={15} color={colors.warning} />
                      <Text style={[styles.statusNote, { color: colors.warning }]}>Rate this order</Text>
                    </Pressable>
                  )}
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardTotal}>{money(order.pricing.total)}</Text>
                    <Pressable
                      onPress={() => reorder(order)}
                      testID={`orders-reorder-${order.id}`}
                      accessibilityRole="button"
                      style={styles.reorderBtn}
                      hitSlop={6}
                    >
                      <Ionicons name="refresh" size={14} color={colors.brandSecondary} />
                      <Text style={styles.reorderText}>Re-order</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.onSurface,
  },
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  pastCard: {
    opacity: 0.92,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardNumber: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.onSurface,
  },
  cardDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  cardSummary: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTotal: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.onSurface,
  },
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  trackText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  reorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reorderText: {
    color: colors.brandSecondary,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  statusNote: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  rateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    minHeight: 44,
  },
}));
