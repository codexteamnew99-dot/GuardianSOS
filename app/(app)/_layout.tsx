import { useEffect } from "react";
import { Redirect, Stack, useRouter } from "expo-router";
import { Alert, View } from "react-native";
import { Loading } from "../../components/Ui";
import { useAuth } from "../../lib/auth";
import { registerPushToken } from "../../lib/push";
import { supabase } from "../../lib/supabase";

export default function AppLayout() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    // non-fatal: profile screen shows the real status + a retry
    registerPushToken(userId).catch(() => {});
  }, [userId]);

  // realtime in-app alert: works even where Expo Go cannot receive remote push
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { title?: string; body?: string; sos_event_id?: string };
          Alert.alert(row.title ?? "🚨 EMERGENCY ALERT", row.body ?? "A guardian alert arrived.", [
            { text: "DISMISS", style: "cancel" },
            {
              text: "VIEW",
              onPress: () =>
                row.sos_event_id && router.push({ pathname: "/guardian/[id]", params: { id: row.sos_event_id } }),
            },
          ]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, router]);

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
