import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Banner, Card, H1, Loading, Muted, Screen } from "../../components/Ui";
import { useAuth } from "../../lib/auth";
import { errMsg, supabase } from "../../lib/supabase";
import type { SosEvent } from "../../lib/types";

export default function HistoryScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<SosEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error: e } = await supabase
        .from("sos_events")
        .select("*")
        .eq("user_id", session.user.id)
        .order("started_at", { ascending: false })
        .limit(50);
      if (e) throw e;
      setRows((data ?? []) as SosEvent[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      <View className="mt-4 flex-row items-center gap-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-full bg-slate-100">
          <ChevronLeft size={22} color="#0F172A" />
        </Pressable>
        <H1>SOS history</H1>
      </View>
      {error ? <View className="mt-4"><Banner kind="error" text={error} /></View> : null}
      {loading ? <Loading /> : null}
      {!loading && rows.length === 0 ? <Muted className="mt-6">No SOS events yet.</Muted> : null}
      <View className="mt-4 gap-2">
        {rows.map((r) => (
          <Card key={r.id}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/sos/[id]", params: { id: r.id } })}>
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-slate-900">{new Date(r.started_at).toLocaleString()}</Text>
                <Text className={`text-sm font-bold ${r.status === "ACTIVE" ? "text-red-600" : "text-green-700"}`}>{r.status}</Text>
              </View>
              <Muted>
                {r.lat != null && r.lng != null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : "No location"}
                {r.resolved_at ? ` · resolved ${new Date(r.resolved_at).toLocaleTimeString()}` : ""}
              </Muted>
            </Pressable>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
