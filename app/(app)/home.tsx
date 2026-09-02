import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { AlertTriangle, ChevronRight, History, MapPin, Phone, Settings, ShieldCheck } from "lucide-react-native";
import { Banner, Btn, Card, IconButton, Muted, Screen } from "../../components/Ui";
import { SosButton, type SosButtonHandle } from "../../components/SosButton";
import { useAuth } from "../../lib/auth";
import { errMsg, supabase } from "../../lib/supabase";
import { activateSos, getActiveSos } from "../../lib/sos";
import { useShakeToSOS } from "../../lib/useShakeToSOS";
import type { SosEvent } from "../../lib/types";

const NAV_TILES = [
  { label: "Contacts", hint: "Who gets alerted", icon: Phone, href: "/contacts" },
  { label: "History", hint: "Past SOS events", icon: History, href: "/history" },
] as const;

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

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useShakeToSOS({
    sosActive: !!active || activating,
    confirmOpen,
    onTrigger: () => sosBtnRef.current?.openConfirm(),
  });

  const onConfirmSos = async () => {
    if (!userId || activating) return;
    setError(null);
    setActivating(true);
    setStatus("Preparing your emergency alert…");
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

  return (
    <Screen>
      <View className="mb-4 mt-4 flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-red-600">
            <ShieldCheck size={26} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold uppercase tracking-widest text-red-600">GuardianSOS</Text>
            <Text className="mt-0.5 text-2xl font-extrabold text-slate-950">Hello, {profile?.full_name?.split(" ")[0] || "there"}</Text>
          </View>
        </View>
        <IconButton
          label="Open profile and settings"
          onPress={() => router.push("/profile")}
          icon={<Settings size={22} color="#0F172A" />}
        />
      </View>

      {error ? <View className="mb-3"><Banner kind="error" text={error} /></View> : null}
      {status ? <View className="mb-3"><Banner kind="info" text={status} /></View> : null}

      {active ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open active SOS"
          onPress={() => router.push({ pathname: "/sos/[id]", params: { id: active.id } })}
          style={({ pressed }) => [
            { marginBottom: 12, borderRadius: 24, backgroundColor: "#991B1B", padding: 18 },
            pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
        >
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-red-500">
              <AlertTriangle size={24} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-white">SOS is active</Text>
              <Text className="mt-0.5 text-sm leading-5 text-red-100">Your emergency screen is ready. Tap to view updates.</Text>
            </View>
            <ChevronRight size={22} color="#FFFFFF" />
          </View>
        </Pressable>
      ) : null}

      <Card className="items-center bg-white">
        <View className="w-full flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-extrabold text-slate-950">Need help right now?</Text>
            <Muted>Hold steady and tap SOS. We’ll guide you through the next step.</Muted>
          </View>
          <View className="h-9 w-9 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle size={18} color="#DC2626" />
          </View>
        </View>
        <View className="my-5">
          <SosButton
            ref={sosBtnRef}
            onConfirm={onConfirmSos}
            activating={activating}
            disabled={!!active}
            onConfirmOpenChange={setConfirmOpen}
          />
        </View>
        <View className="w-full flex-row items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3">
          <ShieldCheck size={18} color="#15803D" />
          <Text className="flex-1 text-sm font-semibold text-emerald-800">
            {contactCount == null
              ? "Checking your emergency contacts…"
              : contactCount === 0
                ? "Add at least one contact for the best protection."
                : `${contactCount} contact${contactCount === 1 ? "" : "s"} will receive your alert`}
          </Text>
        </View>
      </Card>

      {contactCount === 0 ? (
        <Card className="mt-4 border-amber-200 bg-amber-50">
          <Text className="text-base font-bold text-amber-950">Your safety circle is empty</Text>
          <Muted className="mt-1">Add someone you trust so they can receive your location by SMS and call.</Muted>
          <View className="mt-4">
            <Btn title="Add emergency contact" variant="outline" onPress={() => router.push("/contacts")} />
          </View>
        </Card>
      ) : null}

      <View className="mb-2 mt-6 flex-row items-end justify-between">
        <View>
          <Text className="text-xl font-extrabold text-slate-950">Your safety tools</Text>
          <Muted>Everything you need in one place.</Muted>
        </View>
      </View>
      <View className="gap-3">
        {NAV_TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <Pressable
              key={tile.label}
              accessibilityRole="button"
              accessibilityLabel={`Open ${tile.label}`}
              onPress={() => router.push(tile.href)}
              style={({ pressed }) => [
                { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 22, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF", padding: 17 },
                pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] },
              ]}
            >
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
                <Icon size={22} color="#0F172A" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-extrabold text-slate-950">{tile.label}</Text>
                <Text className="mt-0.5 text-sm text-slate-500">{tile.hint}</Text>
              </View>
              <ChevronRight size={20} color="#94A3B8" />
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile and settings"
          onPress={() => router.push("/profile")}
          style={({ pressed }) => [
            { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 22, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF", padding: 17 },
            pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] },
          ]}
        >
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
            <Settings size={22} color="#0F172A" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-slate-950">Profile & settings</Text>
            <Text className="mt-0.5 text-sm text-slate-500">Permissions and account details</Text>
          </View>
          <ChevronRight size={20} color="#94A3B8" />
        </Pressable>
      </View>

      <View className="mb-2 mt-6 flex-row items-center justify-center gap-2">
        <MapPin size={15} color="#64748B" />
        <Text className="text-center text-xs font-medium text-slate-500">Location is only shared when you activate SOS.</Text>
      </View>
    </Screen>
  );
}
