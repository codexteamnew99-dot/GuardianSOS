import "../global.css";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { AuthProvider } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabase";

function Root() {
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
