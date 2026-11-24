import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { useCart } from "@/src/cart";
import { useToast } from "@/src/components/Toast";
import { Field, PrimaryButton } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user, signOut, addAddress, removeAddress } = useAuth();
  const toast = useToast();
  const cart = useCart();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("Home");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const initials = (user?.name || "F")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const saveAddress = async () => {
    if (saving) return;
    if (!line1.trim() || !city.trim() || !zip.trim()) {
      toast.show("Street, city and ZIP are required", "error");
      return;
    }
    setSaving(true);
    try {
      await addAddress({ label: label.trim() || "Home", line1: line1.trim(), city: city.trim(), zip: zip.trim(), note: note.trim() });
      toast.show("Address saved", "success");
      setLine1("");
      setCity("");
      setZip("");
      setNote("");
      setShowForm(false);
    } catch (e: any) {
      toast.show(e?.message || "Could not save the address", "error");
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    cart.clear();
    await signOut();
    router.replace("/login");
  };

  if (!user) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.muted}>Sign in to view your profile.</Text>
        <PrimaryButton label="Sign in" onPress={() => router.replace("/login")} testID="profile-signin-button" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: bottomChrome + 24, gap: 20 }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title} testID="profile-title">
          Profile
        </Text>

        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.muted}>{user.email}</Text>
          </View>
          <View style={styles.clubBadge} testID="profile-club-badge">
            <Text style={styles.clubText}>Forno Club · Gold</Text>
          </View>
        </View>

        {/* Addresses */}
        <View style={{ gap: 12 }}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Saved addresses</Text>
            <Pressable
              onPress={() => setShowForm((v) => !v)}
              testID="profile-toggle-address-form"
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.link}>{showForm ? "Cancel" : "+ Add"}</Text>
            </Pressable>
          </View>

          {user.addresses.length === 0 && !showForm ? (
            <Text style={styles.muted}>No addresses saved yet — add one to speed up checkout.</Text>
          ) : null}

          {user.addresses.map((a) => (
            <View key={a.id} style={styles.addressCard} testID={`profile-address-${a.id}`}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.addressLabel}>
                  {a.label} · {a.line1}
                </Text>
                <Text style={styles.muted}>
                  {a.city} {a.zip}
                  {a.note ? ` · ${a.note}` : ""}
                </Text>
              </View>
              {confirmRemoveId === a.id ? (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable onPress={() => setConfirmRemoveId(null)} testID={`profile-address-cancel-${a.id}`} hitSlop={10}>
                    <Text style={styles.link}>Keep</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      removeAddress(a.id)
                        .then(() => toast.show("Address removed"))
                        .catch((e) => toast.show(e?.message || "Could not remove address", "error"))
                        .finally(() => setConfirmRemoveId(null))
                    }
                    testID={`profile-address-confirm-remove-${a.id}`}
                    hitSlop={10}
                  >
                    <Text style={[styles.link, { color: colors.error }]}>Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setConfirmRemoveId(a.id)}
                  testID={`profile-address-remove-${a.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${a.label} address`}
                  style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              )}
            </View>
          ))}

          {showForm ? (
            <View style={styles.form}>
              <Field label="Label" testID="address-label-input" value={label} onChangeText={setLabel} placeholder="Home, Work…" />
              <Field label="Street address" testID="address-line1-input" value={line1} onChangeText={setLine1} placeholder="24 Ember Lane" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="City" testID="address-city-input" value={city} onChangeText={setCity} placeholder="Naples" />
                </View>
                <View style={{ width: 110 }}>
                  <Field label="ZIP" testID="address-zip-input" value={zip} onChangeText={setZip} placeholder="90210" keyboardType="numbers-and-punctuation" />
                </View>
              </View>
              <Field label="Delivery note (optional)" testID="address-note-input" value={note} onChangeText={setNote} placeholder="Leave at the door" />
              <PrimaryButton label="Save address" onPress={saveAddress} loading={saving} testID="address-save-button" />
            </View>
          ) : null}
        </View>

        {/* Sign out */}
        <Pressable onPress={onSignOut} testID="profile-signout-button" accessibilityRole="button" style={styles.signOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Text style={styles.footer}>Fornello · Crafted with fire since 1987</Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    padding: 24,
    gap: 12,
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.onSurface,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.brandSecondary,
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: colors.onSurface,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
  },
  clubBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  clubText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.brandSecondary,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.onSurface,
  },
  link: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.brandSecondary,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  addressLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.onSurface,
  },
  form: {
    gap: 14,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  signOutText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.error,
  },
  footer: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
  },
}));
