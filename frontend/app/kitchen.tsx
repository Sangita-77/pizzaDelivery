import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, imageUrl } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/Toast";
import { Chip, EmptyState, ErrorState, Loading } from "@/src/components/ui";
import { success, tap } from "@/src/haptics";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import { money, NEXT_ACTION, STATUS_LABEL, type BuilderConfig, type Order, type OrderStatus } from "@/src/types";

dayjs.extend(relativeTime);

type Filter = "new" | "active" | "done" | "ratings";
type Stats = {
  today: { newOrders: number; inProgress: number; delivered: number; cancelled: number; revenue: number };
  ratings: {
    count: number;
    average: number;
    items: { name: string; image: string; count: number; average: number }[];
    recent: { orderId: string; number: number; stars: number; comment: string; at: string; customer: string }[];
  };
};

const REJECT_REASONS = ["Out of ingredients", "Kitchen too busy", "Outside delivery area", "Closing soon"];
const CANCELLABLE: OrderStatus[] = ["placed", "confirmed", "baking", "quality_check"];

export default function Kitchen() {
  const { user, ready, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("new");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]);

  const isOwner = user?.role === "owner";
  const statsQuery = useQuery({
    queryKey: ["kitchen-stats"],
    queryFn: () => api<Stats>("/kitchen/stats"),
    enabled: isOwner,
    refetchInterval: 8000,
  });
  const ordersQuery = useQuery({
    queryKey: ["kitchen-orders", filter],
    queryFn: () => api<{ orders: Order[] }>(`/kitchen/orders?filter=${filter}`),
    enabled: isOwner && filter !== "ratings",
    refetchInterval: 5000,
  });
  const configQuery = useQuery({ queryKey: ["builder-config"], queryFn: () => api<BuilderConfig>("/builder-config"), enabled: isOwner });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    queryClient.invalidateQueries({ queryKey: ["kitchen-stats"] });
  };

  const advance = useMutation({
    mutationFn: (id: string) => api<{ order: Order }>(`/kitchen/orders/${id}/advance`, { method: "POST" }),
    onSuccess: (res) => {
      success();
      toast.show(`Order #${res.order.number} · ${STATUS_LABEL[res.order.status]}`, "success");
      refreshAll();
    },
    onError: (e: any) => {
      toast.show(e?.message || "Could not update the order", "error");
      refreshAll();
    },
  });

  const cancel = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => api<{ order: Order }>(`/kitchen/orders/${id}/cancel`, { method: "POST", json: { reason: why } }),
    onSuccess: (res) => {
      toast.show(`Order #${res.order.number} rejected`);
      setRejectingId(null);
      refreshAll();
    },
    onError: (e: any) => toast.show(e?.message || "Could not reject the order", "error"),
  });

  // Wait for the stored session to load so a refresh/deep link on /kitchen does not bounce to /login.
  if (!ready) return <Loading label="Opening the kitchen…" />;
  if (!user) return <Redirect href="/login" />;
  if (!isOwner) return <Redirect href="/" />;

  const optionName = (group: keyof Omit<BuilderConfig, "basePrice">, id: string) =>
    (configQuery.data?.[group] as { id: string; name: string }[] | undefined)?.find((o) => o.id === id)?.name ?? id;

  const customLine = (d: any) => {
    if (!d?.crust) return d?.sizeName ?? "";
    const toppings = (d.toppings ?? []).map((t: string) => optionName("toppings", t)).join(", ");
    return [optionName("crusts", d.crust), optionName("sauces", d.sauce), optionName("cheeses", d.cheese)].join(" · ") + (toppings ? `\n+ ${toppings}` : "");
  };

  const onSignOut = async () => {
    await signOut();
    queryClient.clear();
    router.replace("/login");
  };

  const t = statsQuery.data?.today;
  const STAT_CARDS = [
    { id: "new", label: "New", value: String(t?.newOrders ?? "–"), icon: "notifications" as const, tone: colors.brandPrimary },
    { id: "active", label: "In progress", value: String(t?.inProgress ?? "–"), icon: "flame" as const, tone: colors.warning },
    { id: "delivered", label: "Delivered today", value: String(t?.delivered ?? "–"), icon: "checkmark-done" as const, tone: colors.success },
    { id: "revenue", label: "Revenue today", value: t ? money(t.revenue) : "–", icon: "cash" as const, tone: colors.info },
  ];

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "new", label: `New${t?.newOrders ? ` · ${t.newOrders}` : ""}` },
    { id: "active", label: `In progress${t?.inProgress ? ` · ${t.inProgress}` : ""}` },
    { id: "done", label: "Completed" },
    { id: "ratings", label: "Ratings" },
  ];

  const renderOrder = (order: Order) => {
    const action = NEXT_ACTION[order.status];
    const canCancel = CANCELLABLE.includes(order.status);
    const rejecting = rejectingId === order.id;
    const isNewOrder = order.status === "placed";
    return (
      <View key={order.id} style={[styles.orderCard, isNewOrder && styles.orderCardNew]} testID={`kitchen-order-${order.id}`}>
        <View style={styles.orderTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNumber}>Order #{order.number}</Text>
            <Text style={styles.orderMeta}>
              {dayjs(order.createdAt).format("h:mm A")} · {dayjs(order.createdAt).fromNow()}
            </Text>
          </View>
          <View style={[styles.statusPill, order.status === "cancelled" && { backgroundColor: colors.error }, order.status === "delivered" && { backgroundColor: colors.success }]}>
            <Text style={styles.statusPillText} testID={`kitchen-order-status-${order.id}`}>
              {STATUS_LABEL[order.status]}
            </Text>
          </View>
        </View>

        <View style={styles.itemsBlock}>
          {order.items.map((i, idx) => (
            <View key={`${i.name}-${idx}`} style={styles.itemRow}>
              <Text style={styles.itemQty}>{i.qty}×</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{i.name}</Text>
                {i.details ? <Text style={styles.itemDetail}>{i.type === "custom" ? customLine(i.details) : i.details.sizeName}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        {order.notes ? (
          <View style={styles.noteBox} testID={`kitchen-order-notes-${order.id}`}>
            <Ionicons name="chatbubble-ellipses" size={14} color={colors.warning} />
            <Text style={styles.noteText}>{order.notes}</Text>
          </View>
        ) : null}

        <View style={styles.customerRow}>
          <Ionicons name="person-circle" size={18} color={colors.muted} />
          <Text style={styles.customerText} numberOfLines={2}>
            {order.customer?.name ?? "Customer"} · {order.address?.line1}, {order.address?.city} {order.address?.zip}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Collect on delivery</Text>
          <Text style={styles.totalValue}>{money(order.pricing.total)}</Text>
        </View>

        {order.status === "cancelled" && order.cancelReason ? <Text style={styles.cancelReason}>Rejected: {order.cancelReason}</Text> : null}
        {order.rating ? (
          <Text style={styles.ratingLine}>
            {"★".repeat(order.rating.stars)}
            {"☆".repeat(5 - order.rating.stars)} {order.rating.comment ? `“${order.rating.comment}”` : ""}
          </Text>
        ) : null}

        {rejecting ? (
          <View style={styles.rejectBox} testID={`kitchen-reject-panel-${order.id}`}>
            <Text style={styles.rejectTitle}>Why are you rejecting this order?</Text>
            <View style={styles.reasonWrap}>
              {REJECT_REASONS.map((r) => (
                <Chip key={r} label={r} active={reason === r} onPress={() => setReason(r)} testID={`kitchen-reject-reason-${r.toLowerCase().replace(/\s+/g, "-")}`} />
              ))}
            </View>
            <View style={styles.actionRow}>
              <Pressable onPress={() => setRejectingId(null)} testID={`kitchen-reject-keep-${order.id}`} accessibilityRole="button" style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>Keep order</Text>
              </Pressable>
              <Pressable
                onPress={() => cancel.mutate({ id: order.id, why: reason })}
                disabled={cancel.isPending}
                testID={`kitchen-reject-confirm-${order.id}`}
                accessibilityRole="button"
                style={[styles.dangerBtn, cancel.isPending && { opacity: 0.6 }]}
              >
                <Text style={styles.dangerText}>{cancel.isPending ? "Rejecting…" : "Reject order"}</Text>
              </Pressable>
            </View>
          </View>
        ) : action || canCancel ? (
          <View style={styles.actionRow}>
            {canCancel ? (
              <Pressable
                onPress={() => {
                  tap();
                  setReason(REJECT_REASONS[0]);
                  setRejectingId(order.id);
                }}
                testID={`kitchen-reject-${order.id}`}
                accessibilityRole="button"
                style={styles.secondaryBtn}
              >
                <Text style={[styles.secondaryText, { color: colors.error }]}>{isNewOrder ? "Reject" : "Cancel"}</Text>
              </Pressable>
            ) : null}
            {action ? (
              <Pressable
                onPress={() => advance.mutate(order.id)}
                disabled={advance.isPending && advance.variables === order.id}
                testID={`kitchen-advance-${order.id}`}
                accessibilityRole="button"
                style={[styles.primaryBtn, advance.isPending && advance.variables === order.id && { opacity: 0.6 }]}
              >
                <Text style={styles.primaryText}>{advance.isPending && advance.variables === order.id ? "Updating…" : action}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderRatings = () => {
    const r = statsQuery.data?.ratings;
    if (statsQuery.isLoading) return <Loading label="Gathering reviews…" />;
    if (!r || r.count === 0)
      return <EmptyState title="No ratings yet" subtitle="Customers can rate their order once it's delivered." testID="kitchen-ratings-empty" />;
    return (
      <View style={{ gap: 16 }} testID="kitchen-ratings">
        <View style={styles.ratingHero}>
          <Text style={styles.ratingBig} testID="kitchen-rating-average">
            {r.average.toFixed(1)}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.ratingStars}>
              {"★".repeat(Math.floor(r.average))}
              {"☆".repeat(5 - Math.floor(r.average))}
            </Text>
            <Text style={styles.orderMeta}>
              Average from {r.count} rated order{r.count > 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Menu items ranked by rating</Text>
        {r.items.map((item, idx) => (
          <View key={item.name} style={styles.rankRow} testID={`kitchen-rank-${idx}`}>
            <Text style={styles.rankNum}>{idx + 1}</Text>
            {item.image ? (
              <Image source={{ uri: imageUrl(item.image) }} style={styles.rankImage} contentFit="cover" />
            ) : (
              <View style={[styles.rankImage, styles.rankPlaceholder]}>
                <Ionicons name="construct" size={16} color={colors.brandPrimary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.orderMeta}>
                {item.count} rating{item.count > 1 ? "s" : ""}
              </Text>
            </View>
            <Text style={styles.rankAvg}>★ {item.average.toFixed(1)}</Text>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Latest reviews</Text>
        {r.recent.map((rev) => (
          <View key={rev.orderId} style={styles.reviewCard}>
            <View style={styles.orderTop}>
              <Text style={styles.itemName}>
                {rev.customer} · #{rev.number}
              </Text>
              <Text style={styles.ratingStarsSmall}>{"★".repeat(rev.stars)}{"☆".repeat(5 - rev.stars)}</Text>
            </View>
            {rev.comment ? <Text style={styles.reviewText}>“{rev.comment}”</Text> : null}
            <Text style={styles.orderMeta}>{dayjs(rev.at).fromNow()}</Text>
          </View>
        ))}
      </View>
    );
  };

  const orders = ordersQuery.data?.orders ?? [];
  const emptyCopy: Record<Exclude<Filter, "ratings">, { title: string; sub: string }> = {
    new: { title: "No new orders", sub: "New orders appear here automatically. Keep the oven hot!" },
    active: { title: "Nothing in progress", sub: "Accepted orders show here until they're delivered." },
    done: { title: "No completed orders", sub: "Delivered and rejected orders are listed here." },
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="kitchen-screen">
      <View style={styles.header}>
        <View style={styles.logo}>
          <Ionicons name="flame" size={20} color={colors.onBrandPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Kitchen</Text>
          <Text style={styles.subtitle}>Fornello · live orders</Text>
        </View>
        <Pressable onPress={onSignOut} testID="kitchen-signout-button" accessibilityRole="button" accessibilityLabel="Sign out" style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={colors.brandPrimary} />}
        stickyHeaderIndices={[1]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          {STAT_CARDS.map((s) => (
            <View key={s.id} style={styles.statCard} testID={`kitchen-stat-${s.id}`}>
              <View style={[styles.statIcon, { backgroundColor: s.tone }]}>
                <Ionicons name={s.icon} size={16} color={colors.onBrandPrimary} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {FILTERS.map((f) => (
              <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} testID={`kitchen-filter-${f.id}`} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.list}>
          {filter === "ratings" ? (
            renderRatings()
          ) : ordersQuery.isLoading ? (
            <Loading label="Loading orders…" />
          ) : ordersQuery.isError ? (
            <ErrorState message={(ordersQuery.error as Error)?.message || "Could not load orders"} onRetry={() => ordersQuery.refetch()} />
          ) : orders.length === 0 ? (
            <EmptyState title={emptyCopy[filter].title} subtitle={emptyCopy[filter].sub} testID={`kitchen-empty-${filter}`} />
          ) : (
            orders.map(renderOrder)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
  logo: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  iconBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  statsRow: { paddingHorizontal: 24, gap: 12, paddingBottom: 4 },
  statCard: { width: 132, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, gap: 6 },
  statIcon: { width: 30, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  statValue: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface },
  statLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  filterBar: { backgroundColor: colors.surface, height: 56, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.divider },
  chipRow: { paddingHorizontal: 24, gap: 8, alignItems: "center" },
  list: { padding: 24, gap: 16 },
  orderCard: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 12 },
  orderCardNew: { borderColor: colors.brandPrimary, borderWidth: 1.5 },
  orderTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  orderNumber: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.onSurface },
  orderMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  statusPill: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.onBrandPrimary },
  itemsBlock: { gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12 },
  itemRow: { flexDirection: "row", gap: 10 },
  itemQty: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.brandSecondary, minWidth: 26 },
  itemName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onSurface },
  itemDetail: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.onSurfaceSecondary },
  noteBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: 10 },
  noteText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.onSurface },
  customerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  customerText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.onSurfaceSecondary },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  totalValue: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onSurface },
  cancelReason: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
  ratingLine: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.warning },
  actionRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 2, height: 48, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onBrandPrimary },
  secondaryBtn: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onSurface },
  dangerBtn: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  dangerText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onError },
  rejectBox: { gap: 10, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 },
  rejectTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onSurface },
  reasonWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  ratingHero: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: 20 },
  ratingBig: { fontFamily: fonts.display, fontSize: 44, color: colors.brandSecondary },
  ratingStars: { fontSize: 20, color: colors.warning, letterSpacing: 2 },
  ratingStarsSmall: { fontSize: 14, color: colors.warning },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10 },
  rankNum: { fontFamily: fonts.display, fontSize: 18, color: colors.muted, width: 22, textAlign: "center" },
  rankImage: { width: 44, height: 44, borderRadius: radius.sm },
  rankPlaceholder: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rankAvg: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.warning },
  reviewCard: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 6 },
  reviewText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.onSurface },
}));
