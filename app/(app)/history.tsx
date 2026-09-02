import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { CheckCircle2, ChevronRight, Clock3, MapPin } from "lucide-react-native";
import { Banner, Card, Loading, Muted, PageHeader, Screen } from "../../components/Ui";
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
    setError(null);
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

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Screen>
      <PageHeader title="SOS history" subtitle="Review previous alerts and their locations." onBack={() => router.back()} />
      {error ? <View className="mb-3"><Banner kind="error" text={error} /></View> : null}
      {loading ? <Loading label="Loading your history…" /> : null}
      {!loading && rows.length === 0 ? (
        <Card className="mt-2 items-center py-10">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Clock3 size={26} color="#64748B" />
          </View>
          <Text className="mt-4 text-lg font-extrabold text-slate-950">No SOS events yet</Text>
          <Muted className="mt-1 max-w-xs text-center">When you activate an SOS, its details will appear here.</Muted>
        </Card>
      ) : null}
      <View className="gap-3">
        {rows.map((r) => {
          const active = r.status === "ACTIVE";
          const started = new Date(r.started_at);
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`Open SOS from ${started.toLocaleDateString()}`}
              onPress={() => router.push({ pathname: "/sos/[id]", params: { id: r.id } })}
              style={({ pressed }) => [
                { borderRadius: 24, borderWidth: 1, borderColor: active ? "#FECACA" : "#E2E8F0", backgroundColor: "#FFFFFF", padding: 18 },
                pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] },
              ]}
            >
              <View className="flex-row items-start gap-3">
                <View className={`h-11 w-11 items-center justify-center rounded-2xl ${active ? "bg-red-100" : "bg-emerald-100"}`}>
                  {active ? <Clock3 size={22} color="#B91C1C" /> : <CheckCircle2 size={22} color="#15803D" />}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-base font-extrabold text-slate-950">{active ? "SOS in progress" : "SOS resolved"}</Text>
                    <ChevronRight size={19} color="#94A3B8" />
                  </View>
                  <Text className="mt-1 text-sm font-medium text-slate-500">{started.toLocaleString()}</Text>
                </View>
              </View>
              <View className="mt-4 flex-row items-center gap-2 border-t border-slate-100 pt-3">
                <MapPin size={15} color="#64748B" />
                <Text className="flex-1 text-sm font-medium text-slate-600">
                  {r.lat != null && r.lng != null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : "Location unavailable"}
                </Text>
                {r.resolved_at ? <Text className="text-xs text-slate-400">Ended {new Date(r.resolved_at).toLocaleTimeString()}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
