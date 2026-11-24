import { QueryClientProvider } from "@tanstack/react-query";
import { SplashScreen, Stack } from "expo-router";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { LogBox, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AuthProvider } from "@/src/auth";
import { CartProvider } from "@/src/cart";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { queryClient } from "@/src/query-client";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "PlayfairDisplay-Bold": require("../assets/fonts/playfair-700.ttf"),
    "PlayfairDisplay-SemiBold": require("../assets/fonts/playfair-600.ttf"),
    "Satoshi-Regular": require("../assets/fonts/Satoshi-Regular.ttf"),
    "Satoshi-Medium": require("../assets/fonts/Satoshi-Medium.ttf"),
    "Satoshi-Bold": require("../assets/fonts/Satoshi-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app. GestureHandlerRootView must wrap the whole tree
  // or any gesture/swipe/drawer screen crashes in Expo Go.
  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            {fontsLoaded ? (
              <AuthProvider>
                <CartProvider>
                  <ToastProvider>
                    <Stack screenOptions={{ headerShown: false }} />
                  </ToastProvider>
                </CartProvider>
              </AuthProvider>
            ) : null}
          </KeyboardProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
