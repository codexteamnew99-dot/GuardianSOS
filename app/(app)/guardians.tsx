import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Banner, Btn, Card, Field, H1, Loading, Muted, Screen } from "../../components/Ui";
import { useAuth } from "../../lib/auth";
import { errMsg, supabase } from "../../lib/supabase";
import type { Guardian, Profile } from "../../lib/types";

export default function Guardians() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;
  const myEmail = session?.user?.email ?? "";
  const [mine, setMine] = useState<Guardian[]>([]);
  const [invites, setInvites] = useState<Guardian[]>([]);
  const [protecting, setProtecting] = useState<Guardian[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const { data, error: e } = await supabase.from("guardians").select("*").order("created_at", { ascending: false });
      if (e) throw e;
      const rows = (data ?? []) as Guardian[];
      setMine(rows.filter((r) => r.owner_id === userId && r.status !== "REMOVED"));
      setInvites(
        rows.filter(
          (r) => r.status === "PENDING" && r.owner_id !== userId && (r.invite_email ?? "").toLowerCase() === myEmail.toLowerCase()
        )
      );
      setProtecting(rows.filter((r) => r.guardian_user_id === userId && r.status === "ACCEPTED"));

      const ids = Array.from(new Set(rows.flatMap((r) => [r.owner_id, r.guardian_user_id]).filter(Boolean) as string[]));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        const map: Record<string, string> = {};
        for (const p of (profs ?? []) as Profile[]) map[p.id] = p.full_name || p.email || "Unknown";
        setNames(map);
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [userId, myEmail]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const add = async () => {
    setError(null);
    setOk(null);
    if (!userId) return setError("Session expired. Sign in again.");
    if (!email.trim() || !email.includes("@")) return setError("Enter the guardian's email address.");
    if (email.trim().toLowerCase() === myEmail.toLowerCase()) return setError("You cannot be your own guardian.");
    setBusy(true);
    try {
      const { error: e } = await supabase.from("guardians").insert({
        owner_id: userId,
        invite_email: email.trim().toLowerCase(),
        invite_phone: phone.trim() || null,
        relationship: relationship.trim() || null,
        status: "PENDING",
      });
      if (e) throw e;
      setEmail("");
      setPhone("");
      setRelationship("");
      setOk("Invite created. They accept it inside GuardianSOS with that email.");
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const accept = async (g: Guardian) => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      // security-definer RPC: the invitee can only accept, never rewrite the owner
      const { error: e } = await supabase.rpc("accept_guardian_invite", { _id: g.id });
      if (e) throw e;
      setOk("You are now a guardian.");
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (g: Guardian) =>
    Alert.alert("Remove guardian?", "They stop receiving your emergency alerts.", [
      { text: "CANCEL", style: "cancel" },
      {
        text: "REMOVE",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            const { error: e } = await supabase.from("guardians").update({ status: "REMOVED" }).eq("id", g.id);
            if (e) throw e;
            await load();
          } catch (e) {
            setError(errMsg(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  const openTheirSos = async (g: Guardian) => {
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from("sos_events")
        .select("id")
        .eq("user_id", g.owner_id)
        .eq("status", "ACTIVE")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e) throw e;
      if (!data) return Alert.alert("All clear", `${names[g.owner_id] ?? "They"} have no active emergency.`);
      router.push({ pathname: "/guardian/[id]", params: { id: (data as { id: string }).id } });
    } catch (e) {
      setError(errMsg(e));
    }
  };

  if (loading) return <Screen><Loading label="Loading guardians…" /></Screen>;

  return (
    <Screen>
      <View className="mt-4 flex-row items-center gap-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-full bg-slate-100">
          <ChevronLeft size={22} color="#0F172A" />
        </Pressable>
        <H1>Guardians</H1>
      </View>

      <View className="mt-4 gap-3">
        {error ? <Banner kind="error" text={error} /> : null}
        {ok ? <Banner kind="success" text={ok} /> : null}
      </View>

      {invites.length > 0 ? (
        <View className="mt-5 gap-2">
          <Text className="text-lg font-bold text-slate-900">Invites for you</Text>
          {invites.map((g) => (
            <Card key={g.id} className="gap-3">
              <Text className="text-base font-semibold text-slate-900">
                {names[g.owner_id] ?? "Someone"} asked you to be their guardian
              </Text>
              {g.relationship ? <Muted>{g.relationship}</Muted> : null}
              <Btn title="ACCEPT" variant="danger" loading={busy} onPress={() => accept(g)} />
            </Card>
          ))}
        </View>
      ) : null}
      <View className="mt-6 gap-2">
        <Text className="text-lg font-bold text-slate-900">Your guardians</Text>
        {mine.length === 0 ? <Muted>None yet. Add someone below.</Muted> : null}
        {mine.map((g) => (
          <Card key={g.id} className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-base font-semibold text-slate-900">
                {g.guardian_user_id ? names[g.guardian_user_id] ?? g.invite_email : g.invite_email}
              </Text>
              <Text className={`text-sm font-bold ${g.status === "ACCEPTED" ? "text-green-700" : "text-amber-700"}`}>
                {g.status}
              </Text>
            </View>
            {g.relationship ? <Muted>{g.relationship}</Muted> : null}
            {g.invite_phone ? <Muted>{g.invite_phone}</Muted> : null}
            <Btn title="Remove" variant="ghost" onPress={() => remove(g)} />
          </Card>
        ))}
      </View>

      {protecting.length > 0 ? (
        <View className="mt-6 gap-2">
          <Text className="text-lg font-bold text-slate-900">You protect</Text>
          {protecting.map((g) => (
            <Card key={g.id}>
              <Pressable accessibilityRole="button" onPress={() => openTheirSos(g)} className="gap-1">
                <Text className="text-base font-semibold text-slate-900">{names[g.owner_id] ?? "Unknown"}</Text>
                <Muted>Tap to check for an active emergency</Muted>
              </Pressable>
            </Card>
          ))}
        </View>
      ) : null}

      <View className="mt-6 gap-3">
        <Text className="text-lg font-bold text-slate-900">Add a guardian</Text>
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="guardian@example.com" keyboardType="email-address" />
        <Field label="Phone (optional)" value={phone} onChangeText={setPhone} placeholder="+1 555 0100" keyboardType="phone-pad" />
        <Field label="Relationship (optional)" value={relationship} onChangeText={setRelationship} placeholder="Sister" autoCapitalize="words" />
        <Btn title="SEND INVITE" variant="danger" loading={busy} onPress={add} />
      </View>

    </Screen>
  );
}


