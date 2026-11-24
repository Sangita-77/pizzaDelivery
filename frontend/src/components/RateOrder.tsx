import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { PrimaryButton } from "@/src/components/ui";
import { success, tap } from "@/src/haptics";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";
import type { Order } from "@/src/types";

const STAR_HINT = ["", "Not great", "Could be better", "Good", "Really good", "Outstanding!"];

// Star rating card shown on a delivered order (rate once, then read-only).
export function RateOrder({ order }: { order: Order }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  if (order.rating) {
    return (
      <View style={styles.card} testID="order-rating-done">
        <Text style={styles.title}>Your rating</Text>
        <Text style={styles.starsRead}>
          {"★".repeat(order.rating.stars)}
          <Text style={{ color: colors.border }}>{"★".repeat(5 - order.rating.stars)}</Text>
        </Text>
        {order.rating.comment ? <Text style={styles.comment}>“{order.rating.comment}”</Text> : null}
        <Text style={styles.thanks}>Thanks — it helps our pizzaiolos keep the fire right.</Text>
      </View>
    );
  }

  const submit = async () => {
    if (!stars || saving) return;
    setSaving(true);
    try {
      const res = await api<{ order: Order }>(`/orders/${order.id}/rating`, { method: "POST", json: { stars, comment } });
      queryClient.setQueryData(["order", order.id], res);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      success();
      toast.show("Thanks for rating your order!", "success");
    } catch (e: any) {
      toast.show(e?.message || "Could not save your rating", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card} testID="order-rating-form">
      <Text style={styles.title}>How was your pizza?</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => {
              tap();
              setStars(n);
            }}
            testID={`order-rating-star-${n}`}
            accessibilityRole="button"
            accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
            style={styles.starBtn}
          >
            <Ionicons name={n <= stars ? "star" : "star-outline"} size={32} color={n <= stars ? colors.warning : colors.muted} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>{stars ? STAR_HINT[stars] : "Tap a star to rate"}</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Tell us more (optional)"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={500}
        style={styles.input}
        testID="order-rating-comment"
      />
      <PrimaryButton label="Submit rating" onPress={submit} loading={saving} disabled={!stars} testID="order-rating-submit" />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.onSurface },
  starRow: { flexDirection: "row", gap: 4 },
  starBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  hint: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
  input: {
    minHeight: 80,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    textAlignVertical: "top",
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onSurface,
  },
  starsRead: { fontSize: 24, color: colors.warning, letterSpacing: 2 },
  comment: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.onSurface },
  thanks: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
}));
