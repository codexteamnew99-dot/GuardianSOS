import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { History, Phone, Settings, ShieldCheck } from "lucide-react-native";
import { Banner, Card, Muted, Screen } from "../../components/Ui";
import { SosButton, type SosButtonHandle } from "../../components/SosButton";
import { useAuth } from "../../lib/auth";
import { errMsg, supabase } from "../../lib/supabase";
import { activateSos, getActiveSos } from "../../lib/sos";
import { useShakeToSOS } from "../../lib/useShakeToSOS";
import type { SosEvent } from "../../lib/types";

export default function Home() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;
  const [active, setActive] = useState<SosEvent | null>(null);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [activating, setActivating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const sosBtnRef = useRef<SosButtonHandle>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      setActive(await getActiveSos(userId));
      const { count, error: cErr } = await supabase
        .from("emergency_contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (cErr) throw cErr;
      setContactCount(count ?? 0);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useShakeToSOS({
    sosActive: !!active || activating,
    confirmOpen,
    onTrigger: () => sosBtnRef.current?.openConfirm(),
  });

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
    { label: "Contacts", icon: Phone, href: "/contacts" },
    { label: "History", icon: History, href: "/history" },
    { label: "Profile", icon: Settings, href: "/profile" },
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
        {contactCount === 0 ? (
          <Pressable onPress={() => router.push("/contacts")}>
            <Banner kind="warn" text="No emergency contacts yet — add one so SOS can text and call someone." />
          </Pressable>
        ) : null}
      </View>

      <View className="mt-6">
        <SosButton
          ref={sosBtnRef}
          onConfirm={onConfirmSos}
          activating={activating}
          onConfirmOpenChange={setConfirmOpen}
        />
      </View>

      <View className="mt-6 flex-row items-center gap-2">
        <ShieldCheck size={18} color="#16A34A" />
        <Muted>
          {contactCount == null
            ? "Checking contacts…"
            : `${contactCount} contact${contactCount === 1 ? "" : "s"} get an SMS + call`}
        </Muted>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-3">
        {navTiles.map((t) => (
          <Card key={t.label} className="w-[47%]">
            <Pressable accessibilityRole="button" onPress={() => router.push(t.href)} className="min-h-20 justify-between">
              <t.icon size={24} color="#0F172A" />
              <Text className="mt-3 text-lg font-semibold text-slate-900">{t.label}</Text>
            </Pressable>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
