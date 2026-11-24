// Small shared UI primitives. All interactive elements carry testIDs.

import { ActivityIndicator, Pressable, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";

import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  testID,
  tone = "brand",
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID: string;
  tone?: "brand" | "dark";
  style?: ViewStyle;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bg = tone === "brand" ? colors.brandPrimary : colors.surfaceInverse;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.onBrandPrimary} testID={`${testID}-spinner`} /> : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.chipText, active && { color: colors.onBrandPrimary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Stepper({
  value,
  onInc,
  onDec,
  testIDPrefix,
}: {
  value: number;
  onInc: () => void;
  onDec: () => void;
  testIDPrefix: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onDec} testID={`${testIDPrefix}-dec`} accessibilityRole="button" style={styles.stepBtn} hitSlop={4}>
        <Text style={styles.stepSymbol}>−</Text>
      </Pressable>
      <Text style={styles.stepValue} testID={`${testIDPrefix}-qty`}>
        {value}
      </Text>
      <Pressable onPress={onInc} testID={`${testIDPrefix}-inc`} accessibilityRole="button" style={[styles.stepBtn, styles.stepBtnFilled]} hitSlop={4}>
        <Text style={[styles.stepSymbol, { color: colors.onBrandPrimary }]}>+</Text>
      </Pressable>
    </View>
  );
}

export function Field({
  label,
  testID,
  ...inputProps
}: { label: string; testID: string } & TextInputProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.fieldInput}
        placeholderTextColor={colors.muted}
        {...inputProps}
      />
    </View>
  );
}

export function VegDot({ veg }: { veg: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.vegBox, { borderColor: veg ? colors.success : colors.error }]} testID={`veg-badge-${veg ? "veg" : "nonveg"}`}>
      <View style={[styles.vegDot, { backgroundColor: veg ? colors.success : colors.error }]} />
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Loading({ label }: { label?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stateView} testID="loading-view">
      <ActivityIndicator size="large" color={colors.brandPrimary} />
      {label ? <Text style={styles.stateLabel}>{label}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.stateView} testID="error-view">
      <Text style={styles.stateTitle}>Something went wrong</Text>
      <Text style={styles.stateLabel}>{message}</Text>
      <Pressable onPress={onRetry} testID="error-retry-button" accessibilityRole="button" style={styles.retryBtn}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({ title, subtitle, actionLabel, onAction, testID }: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  testID: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.stateView} testID={testID}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateLabel}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} testID={`${testID}-action`} accessibilityRole="button" style={styles.retryBtn}>
          <Text style={styles.retryText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  primaryButton: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: {
    backgroundColor: colors.brandPrimary,
  },
  chipText: {
    color: colors.onSurfaceTertiary,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnFilled: {
    backgroundColor: colors.brandPrimary,
  },
  stepSymbol: {
    color: colors.onSurface,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: fonts.bodyBold,
  },
  stepValue: {
    color: colors.onSurface,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    minWidth: 20,
    textAlign: "center",
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  fieldInput: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 52,
    paddingHorizontal: 16,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  vegBox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionTitle: {
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 20,
  },
  stateView: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  stateTitle: {
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 20,
    textAlign: "center",
  },
  stateLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 6,
  },
  retryText: {
    color: colors.onBrandPrimary,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
}));
