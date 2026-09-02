import "../global.css";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { ShieldAlert } from "lucide-react-native";
import { Text, View } from "react-native";
import { AuthProvider } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabase";

function Root() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F8FAFC" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

function ConfigurationNotice() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50 px-6">
      <View className="w-full max-w-lg items-center rounded-3xl border border-slate-200 bg-white p-7" style={{ shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}>
        <View className="h-16 w-16 items-center justify-center rounded-3xl bg-red-100">
          <ShieldAlert size={32} color="#B91C1C" />
        </View>
        <Text className="mt-5 text-center text-2xl font-extrabold text-slate-950">GuardianSOS needs one last setup step</Text>
        <Text className="mt-3 text-center text-base leading-6 text-slate-600">
          The web bundle loaded successfully, but Supabase connection settings are not available in this deployment yet.
        </Text>
        <View className="mt-5 w-full rounded-2xl bg-slate-100 p-4">
          <Text className="text-sm font-bold text-slate-700">Add these variables in Vercel Project Settings → Environment Variables:</Text>
          <Text className="mt-3 font-mono text-sm leading-6 text-slate-800">EXPO_PUBLIC_SUPABASE_URL{`\n`}EXPO_PUBLIC_SUPABASE_ANON_KEY</Text>
        </View>
        <Text className="mt-4 text-center text-sm leading-5 text-slate-500">Redeploy after saving the variables. No service-role key is needed in the browser.</Text>
      </View>
    </View>
  );
}

export default function RootLayout() {
  if (!supabaseConfigured) return <ConfigurationNotice />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AuthProvider>
        <Root />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
