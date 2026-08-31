import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { AuthProvider } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabase";
import { isExpoGo } from "../lib/push";

function useNotificationRouting() {
  const router = useRouter();

  useEffect(() => {
    // Expo Go can't receive remote push; the Supabase Realtime alert in (app)/_layout handles routing there.
    if (isExpoGo) return;
    const Notifications = require("expo-notifications") as typeof import("expo-notifications");
    const go = (data: unknown) => {
      const sosId = (data as { sosEventId?: string })?.sosEventId;
      if (typeof sosId === "string" && sosId) router.push({ pathname: "/guardian/[id]", params: { id: sosId } });
    };
    // cold start: app launched by tapping a notification
    Notifications.getLastNotificationResponseAsync().then((res) => {
      if (res) go(res.notification.request.content.data);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((res) =>
      go(res.notification.request.content.data)
    );
    return () => sub.remove();
  }, [router]);
}

function Root() {
  useNotificationRouting();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#fff" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}
export default function RootLayout() {
  if (!supabaseConfigured) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-xl font-bold text-red-700">Supabase is not configured</Text>
        <Text className="mt-2 text-center text-base text-slate-600">
          Create a .env file with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart with
          `npx expo start -c`.
        </Text>
      </View>
    );
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AuthProvider>
        <Root />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

