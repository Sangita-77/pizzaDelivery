import { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Linking } from "react-native";

import { api } from "@/src/api";
import { RateOrder } from "@/src/components/RateOrder";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { ErrorState, Loading } from "@/src/components/ui";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import { money, STATUS_LABEL, STATUS_ORDER, type Order, type OrderStatus } from "@/src/types";

const STAGES: OrderStatus[] = ["confirmed", "baking", "quality_check", "out_for_delivery", "delivered"];

export default function OrderTracking() {
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();

  const orderQuery = useQuery({
    queryKey: ["order", id],
    queryFn: () => api<{ order: Order }>(`/orders/${id}`),
    refetchInterval: (q: any) => (["delivered", "cancelled"].includes(q?.state?.data?.order?.status) ? false : 4000),
  });

  if (orderQuery.isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Loading label="Connecting to the kitchen…" />
      </View>
    );
  }
  if (orderQuery.isError || !orderQuery.data?.order) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ErrorState message="We lost track of this order." onRetry={() => orderQuery.refetch()} />
      </View>
    );
  }

  const order = orderQuery.data.order;
  const currentIdx = STATUS_ORDER.indexOf(order.status);
  const delivered = order.status === "delivered";
  const cancelled = order.status === "cancelled";

  const timeFor = (status: OrderStatus) => {
    const h = order.statusHistory.find((s) => s.status === status);
    return h ? dayjs(h.at).format("h:mm A") : "";
  };

  const heroSub = cancelled
    ? order.cancelReason || "The restaurant couldn't take this order"
    : delivered
      ? `Delivered at ${timeFor("delivered")}`
      : order.status === "placed"
        ? "The kitchen will accept your order in a moment"
        : order.status === "out_for_delivery"
          ? "Arriving in about 10 minutes"
          : `Estimated arrival in ~${order.etaMinutes} min`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="order-tracking-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.dismissTo("/(tabs)/orders")} testID="order-back-button" accessibilityRole="button" hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Order #{order.number}</Text>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 24, gap: 20 }}
      >
        {isNew ? (
          <View style={styles.confettiCard} testID="order-confirmed-banner">
            <Ionicons name="checkmark-circle" size={26} color={colors.onBrandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.confettiTitle}>Order placed!</Text>
              <Text style={styles.confettiSub}>We&apos;ve sent it to the kitchen — sit tight.</Text>
            </View>
          </View>
        ) : null}

        {/* Status hero */}
        <View style={[styles.statusHero, cancelled && { backgroundColor: colors.error }]}>
          <Text style={[styles.statusHeroLabel, cancelled && { color: colors.onError }]} testID="order-status-label">
            {STATUS_LABEL[order.status]}
          </Text>
          <Text style={[styles.statusHeroEta, cancelled && { color: colors.onError }]} testID="order-status-sub">
            {heroSub}
          </Text>
        </View>

        {/* Timeline */}
        {cancelled ? null : (
        <View style={styles.timeline}>
          {STAGES.map((stage, idx) => {
            const done = currentIdx >= STATUS_ORDER.indexOf(stage) && !(stage === "delivered" && !delivered);
            const current = STATUS_ORDER.indexOf(stage) === currentIdx && !delivered;
            const reached = STATUS_ORDER.indexOf(stage) <= currentIdx;
            return (
              <View key={stage} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  {idx > 0 ? <View style={[styles.railLine, reached && styles.railLineDone]} /> : null}
                  <TimelineDot done={reached} current={current} />
                  {idx < STAGES.length - 1 ? <View style={[styles.railLine, reached && styles.railLineDone]} /> : null}
                </View>
                <View style={styles.timelineBody}>
                  <Text style={[styles.stageLabel, reached && { color: colors.onSurface, fontFamily: fonts.bodyBold }]} testID={`order-stage-${stage}`}>
                    {STATUS_LABEL[stage]}
                  </Text>
                  {reached && timeFor(stage) ? <Text style={styles.stageTime}>{timeFor(stage)}</Text> : null}
                  {stage === "baking" && current ? <Text style={styles.stageHint}>Blistering at 450°C over oak embers</Text> : null}
                  {stage === "out_for_delivery" && current ? <Text style={styles.stageHint}>{order.driver?.name} is on the way to you</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
        )}

        {/* Driver card */}
        {(order.status === "out_for_delivery" || delivered) && order.driver ? (
          <View style={styles.driverCard} testID="order-driver-card">
            <View style={styles.driverAvatar}>
              <Text style={styles.driverInitial}>{order.driver.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{order.driver.name}</Text>
              <Text style={styles.driverVehicle}>{order.driver.vehicle}</Text>
            </View>
            <Pressable
              onPress={() => Linking.openURL(`tel:${order.driver?.phone}`).catch(() => {})}
              testID="order-driver-call-button"
              accessibilityRole="button"
              accessibilityLabel="Call the driver"
              style={styles.callBtn}
            >
              <Ionicons name="call" size={18} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        ) : null}

        {/* Summary */}
        <View style={styles.summaryCard} testID="order-summary">
          <Text style={styles.summaryTitle}>Order summary</Text>
          {order.items.map((i, idx) => (
            <View key={`${i.name}-${idx}`} style={styles.totalRow}>
              <Text style={styles.totalLabel} numberOfLines={1}>
                {i.qty}× {i.name}
              </Text>
              <Text style={styles.totalValue}>{money(i.unitPrice * i.qty)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Delivery to</Text>
            <Text style={styles.infoValue} testID="order-address">
              {order.address?.label} · {order.address?.line1}, {order.address?.city} {order.address?.zip}
            </Text>
          </View>
          {order.notes ? (
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Notes</Text>
              <Text style={styles.infoValue} testID="order-notes">
                {order.notes}
              </Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalBold}>Total (Cash on Delivery)</Text>
            <Text style={styles.totalBold} testID="order-total">
              {money(order.pricing.total)}
            </Text>
          </View>
        </View>

        {delivered ? <RateOrder order={order} /> : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

function TimelineDot({ done, current }: { done: boolean; current: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!current) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [current, pulse]);

  return (
    <View style={styles.dotWrap}>
      {current ? (
        <Animated.View style={[styles.dotPulse, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }] }]} />
      ) : null}
      <View style={[styles.dot, done && styles.dotDone]}>
        {done ? <Ionicons name="checkmark" size={11} color={colors.onBrandPrimary} /> : null}
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
    paddingTop: 12,
    paddingBottom: 8,
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
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.onSurface,
  },
  confettiCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    padding: 16,
  },
  confettiTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.onSuccess,
  },
  confettiSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.onSuccess,
    opacity: 0.9,
  },
  statusHero: {
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
    padding: 20,
    gap: 4,
  },
  statusHeroLabel: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.brandSecondary,
  },
  statusHeroEta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 14,
  },
  timelineRail: {
    width: 32,
    alignItems: "center",
  },
  railLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
  },
  railLineDone: {
    backgroundColor: colors.brandPrimary,
  },
  dotWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  dotPulse: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  timelineBody: {
    flex: 1,
    paddingVertical: 12,
    gap: 2,
  },
  stageLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.muted,
  },
  stageTime: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  stageHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.brandSecondary,
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  driverInitial: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.brandSecondary,
  },
  driverName: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.onSurface,
  },
  driverVehicle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 8,
  },
  summaryTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.onSurface,
    marginBottom: 4,
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
    fontSize: 15,
    color: colors.onSurface,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  infoBlock: {
    gap: 2,
  },
  infoLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  infoValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
  },
}));
