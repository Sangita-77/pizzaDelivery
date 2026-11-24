// Lightweight top toast. Mount ToastProvider high (above the tab bar) and call
// useToast().show("message") from anywhere.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

type ToastTone = "default" | "success" | "error";
type ToastContextValue = { show: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<ToastTone>("default");
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, msgTone: ToastTone = "default") => {
    setMessage(msg);
    setTone(msgTone);
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setMessage(null));
    }, 2200);
  }, [opacity]);

  const value = useMemo(() => ({ show }), [show]);

  const bg = tone === "success" ? colors.success : tone === "error" ? colors.error : colors.surfaceInverse;
  const fg = tone === "success" || tone === "error" ? "#FFFFFF" : colors.onSurfaceInverse;

  return (
    <ToastContext.Provider value={value}>
    <View style={{ flex: 1 }}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="none"
          testID="toast"
          style={[styles.toast, { bottom: insets.bottom + 96, backgroundColor: bg, opacity, zIndex: 1000 }]}
        >
          <Text style={[styles.toastText, { color: fg }]}>{message}</Text>
        </Animated.View>
      ) : null}
    </View>
    </ToastContext.Provider>
  );
}

const useStyles = makeStyles((colors) => ({
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: colors.surfaceInverse,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    textAlign: "center",
  },
}));
