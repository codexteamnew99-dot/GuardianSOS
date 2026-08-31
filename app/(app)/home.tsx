import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { History, Phone, Settings, ShieldCheck, Users } from "lucide-react-native";
import { Banner, Btn, Card, Muted, Screen } from "../../components/Ui";
import { SosButton } from "../../components/SosButton";
import { useAuth } from "../../lib/auth";
import { errMsg, supabase } from "../../lib/supabase";
import { activateSos, getActiveSos } from "../../lib/sos";
import type { SosEvent } from "../../lib/types";

export default function Home() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;
  const [active, setActive] = useState<SosEvent | null>(null);
  const [guardianCount, setGuardianCount] = useState<number | null>(null);
  const [pendingForMe, setPendingForMe] = useState(0);
  const [activating, setActivating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      setActive(await getActiveSos(userId));
      const { count, error: gErr } = await supabase
        .from("guardians")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("status", "ACCEPTED");
      if (gErr) throw gErr;
      setGuardianCount(count ?? 0);

      const email = session?.user?.email ?? "";
      const { data: invites } = await supabase
        .from("guardians")
        .select("id")
        .eq("status", "PENDING")
        .ilike("invite_email", email);
      setPendingForMe(invites?.length ?? 0);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [userId, session?.user?.email]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onConfirmSos = async () => {
    if (!userId || activating) return;
    setError(null);
    setActivating(true);
    setStatus("Activating SOS…");
    try {
      const existing = await getActiveSos(userId);
      if (existing) {
        setStatus(null);
        router.push({ pathname: "/sos/[id]", params: { id: existing.id } });
        return;
      }
      setStatus("Getting your GPS location…");
      const { event } = await activateSos(userId);
      setStatus(null);
      router.push({ pathname: "/sos/[id]", params: { id: event.id, fresh: "1" } });
    } catch (e) {
      setStatus(null);
      setError(errMsg(e));
    } finally {
      setActivating(false);
    }
  };

  const navTiles = [
    { label: "Guardians", icon: Users, href: "/guardians", badge: pendingForMe },
    { label: "Contacts", icon: Phone, href: "/contacts", badge: 0 },
    { label: "History", icon: History, href: "/history", badge: 0 },
    { label: "Profile", icon: Settings, href: "/profile", badge: 0 },
  ] as const;
  return (
    <Screen>
      <View className="mt-4 flex-row items-center justify-between">
        <View>
          <Muted>Hello</Muted>
          <Text className="text-2xl font-bold text-slate-900">{profile?.full_name || "there"}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
          onPress={() => router.push("/profile")}
          className="h-12 w-12 items-center justify-center rounded-full bg-slate-100"
        >
          <Settings size={22} color="#0F172A" />
        </Pressable>
      </View>

      <View className="mt-4 gap-3">
        {error ? <Banner kind="error" text={error} /> : null}
        {status ? <Banner kind="info" text={status} /> : null}
        {active ? (
          <Pressable onPress={() => router.push({ pathname: "/sos/[id]", params: { id: active.id } })}>
            <Banner kind="error" text="SOS is ACTIVE — tap to open the emergency screen" />
          </Pressable>
        ) : null}
        {guardianCount === 0 ? (
          <Pressable onPress={() => router.push("/guardians")}>
            <Banner kind="warn" text="No accepted guardians yet — add one so alerts reach someone." />
          </Pressable>
        ) : null}
        {pendingForMe > 0 ? (
          <Pressable onPress={() => router.push("/guardians")}>
            <Banner kind="info" text={`${pendingForMe} guardian invite waiting for you — tap to accept.`} />
          </Pressable>
        ) : null}
      </View>

      <View className="mt-6">
        <SosButton onConfirm={onConfirmSos} activating={activating} />
      </View>

      <View className="mt-6 flex-row items-center gap-2">
        <ShieldCheck size={18} color="#16A34A" />
        <Muted>
          {guardianCount == null ? "Checking guardians…" : `${guardianCount} guardian${guardianCount === 1 ? "" : "s"} will be alerted`}
        </Muted>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-3">
        {navTiles.map((t) => (
          <Card key={t.label} className="w-[47%]">
            <Pressable accessibilityRole="button" onPress={() => router.push(t.href)} className="min-h-20 justify-between">
              <t.icon size={24} color="#0F172A" />
              <Text className="mt-3 text-lg font-semibold text-slate-900">{t.label}</Text>
              {t.badge > 0 ? <Text className="text-sm font-semibold text-red-600">{t.badge} pending</Text> : null}
            </Pressable>
          </Card>
        ))}
      </View>
    </Screen>
  );
}


