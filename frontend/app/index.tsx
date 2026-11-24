import { useEffect } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export default function Index() {
  const { ready, user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();

  useEffect(() => {
    if (!ready) return;
    router.replace(!user ? "/login" : user.role === "owner" ? "/kitchen" : "/(tabs)");
  }, [ready, user, router]);

  return (
    <View style={styles.splash} testID="splash-gate">
      <View style={styles.badge}>
        <Ionicons name="flame" size={40} color={colors.onBrandPrimary} />
      </View>
      <Text style={styles.wordmark}>Fornello</Text>
      <Text style={styles.tagline}>Artisan wood-fired pizza</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  splash: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.onSurface,
  },
  tagline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
    letterSpacing: 0.4,
  },
}));
