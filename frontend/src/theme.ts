// Design tokens for Fornello Artisan Pizza — light editorial theme.
// Values come from /app/design_guidelines.json (warm artisan: cream + burnt orange).
//
//   <View style={{ backgroundColor: colors.brandPrimary }}>
//     <Text style={{ color: colors.onBrandPrimary }}>Continue</Text>
//   </View>
//
// Build style sheets with makeStyles so they follow the active scheme; read
// useTheme().colors for color props (icon color, placeholderTextColor, ...).

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces: backgrounds, from the screen down to small fills.
  surface: "#FDFBF7",
  onSurface: "#2C2621",
  surfaceSecondary: "#F5EFE6",
  onSurfaceSecondary: "#3D352E",
  surfaceTertiary: "#EBE2D3",
  onSurfaceTertiary: "#4E433A",
  surfaceInverse: "#1F1A17",
  onSurfaceInverse: "#FDFBF7",
  muted: "#7A6E63",

  // Brand: burnt orange flame identity.
  brand: "#D95D39",
  onBrand: "#FFFFFF",
  brandPrimary: "#D95D39",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#B54322",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FCECE6",
  onBrandTertiary: "#B54322",

  // Status: semantic only.
  success: "#3B6D4F",
  onSuccess: "#FFFFFF",
  warning: "#C27803",
  onWarning: "#FFFFFF",
  error: "#BA3C3C",
  onError: "#FFFFFF",
  info: "#3A6073",
  onInfo: "#FFFFFF",

  // Lines
  border: "#E5DCD0",
  borderStrong: "#D95D39",
  divider: "#EFE7DC",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// Typography: display = Playfair Display (editorial headings), body = Satoshi.
export const fonts = {
  display: "PlayfairDisplay-Bold",
  displaySemi: "PlayfairDisplay-SemiBold",
  body: "Satoshi-Regular",
  bodyMedium: "Satoshi-Medium",
  bodyBold: "Satoshi-Bold",
} as const;

// Spacing + radius tokens from design_guidelines.json.
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
