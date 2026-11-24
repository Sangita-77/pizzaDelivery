import { Ionicons } from "@react-native-vector-icons/ionicons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { fonts, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  // iOS 26+ gets true native tab bars (Liquid Glass); everything else uses the
  // classic JS tab bar styled for the warm artisan palette.
  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="house.fill" />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="menu">
          <NativeTabs.Trigger.Icon sf="fork.knife" />
          <NativeTabs.Trigger.Label>Menu</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="orders">
          <NativeTabs.Trigger.Icon sf="receipt" />
          <NativeTabs.Trigger.Label>Orders</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.fill" />
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="menu"
        options={{ title: "Menu", tabBarIcon: ({ color }) => <Ionicons name="pizza" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "Orders", tabBarIcon: ({ color }) => <Ionicons name="receipt" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} /> }}
      />
    </Tabs>
  );
}
