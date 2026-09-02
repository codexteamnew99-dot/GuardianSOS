import { useEffect } from "react";
import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { Loading } from "../../components/Ui";
import { useAuth } from "../../lib/auth";
import { ensureEmergencyPermissions } from "../../lib/emergencyAlert";

export default function AppLayout() {
  const { session, loading } = useAuth();
  const userId = session?.user?.id;

  // Ask for SMS/call access ONCE at login so a real SOS never stops to prompt.
  useEffect(() => {
    if (!userId) return;
    ensureEmergencyPermissions().catch(() => {});
  }, [userId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Loading />
      </View>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
