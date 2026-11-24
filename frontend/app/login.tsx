import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Field, PrimaryButton } from "@/src/components/ui";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Please enter a valid email address");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace(redirect ? (redirect as "/(tabs)") : "/");
    } catch (e: any) {
      setError(e?.message || "Could not sign in. Please try again");
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoBadge} testID="login-logo">
          <Ionicons name="flame" size={30} color={colors.onBrandPrimary} />
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to fire up your order.</Text>

        <View style={styles.form}>
          <Field
            label="Email"
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
          />
          {error ? (
            <Text style={styles.error} testID="login-error">
              {error}
            </Text>
          ) : null}
          <PrimaryButton label="Sign in" onPress={submit} loading={submitting} testID="login-submit-button" />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>New to Fornello?</Text>
          <Pressable onPress={() => router.push("/register")} testID="login-to-register" hitSlop={8}>
            <Text style={styles.switchLink}>Create an account</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    padding: 24,
    gap: 8,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.onSurface,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.muted,
    marginBottom: 20,
  },
  form: {
    gap: 16,
  },
  error: {
    color: colors.error,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: "hidden",
  },
  switchRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 16,
  },
  switchText: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 14,
  },
  switchLink: {
    fontFamily: fonts.bodyBold,
    color: colors.brandSecondary,
    fontSize: 14,
  },
}));
