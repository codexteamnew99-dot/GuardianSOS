import { Alert, Platform, Pressable, Text, View } from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Edit3, HeartHandshake, Phone, Plus, Share2, Trash2 } from "lucide-react-native";
import { Banner, Btn, Card, Field, Loading, Muted, PageHeader, Screen, SectionTitle } from "../../components/Ui";
import { useAuth } from "../../lib/auth";
import { errMsg, supabase } from "../../lib/supabase";
import { getFix } from "../../lib/location";
import { callNumber, shareLocation } from "../../lib/share";
import type { EmergencyContact } from "../../lib/types";

export default function Contacts() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user?.id;
  const [rows, setRows] = useState<EmergencyContact[]>([]);
  const [editing, setEditing] = useState<EmergencyContact | null>(null);
  const [name, setName] = useState("");
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
      const { data, error: e } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (e) throw e;
      setRows((data ?? []) as EmergencyContact[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const reset = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setRelationship("");
  };

  const save = async () => {
    setError(null);
    setOk(null);
    if (!userId) return setError("Your session expired. Please sign in again.");
    if (!name.trim() || !phone.trim()) return setError("Add both a name and phone number.");
    setBusy(true);
    try {
      const payload = { name: name.trim(), phone: phone.trim(), relationship: relationship.trim() || null };
      const { error: e } = editing
        ? await supabase.from("emergency_contacts").update(payload).eq("id", editing.id)
        : await supabase.from("emergency_contacts").insert({ ...payload, user_id: userId });
      if (e) throw e;
      setOk(editing ? "Contact updated." : "Contact added to your safety circle.");
      reset();
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const removeContact = async (c: EmergencyContact) => {
    try {
      const { error: e } = await supabase.from("emergency_contacts").delete().eq("id", c.id);
      if (e) throw e;
      if (editing?.id === c.id) reset();
      await load();
      setOk(`${c.name} was removed from your contacts.`);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const del = (c: EmergencyContact) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(`Remove ${c.name} from your emergency contacts?`)) void removeContact(c);
      return;
    }
    Alert.alert("Remove contact?", `${c.name} will no longer receive SOS alerts.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void removeContact(c) },
    ]);
  };

  const share = async () => {
    setError(null);
    setBusy(true);
    try {
      const fix = await getFix();
      await shareLocation(fix.lat, fix.lng);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageHeader title="Emergency contacts" subtitle="People who should know if you need help." onBack={() => router.back()} />

      {error ? <View className="mb-3"><Banner kind="error" text={error} /></View> : null}
      {ok ? <View className="mb-3"><Banner kind="success" text={ok} /></View> : null}

      <Card className="border-red-100 bg-red-50">
        <View className="flex-row items-start gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-red-100">
            <HeartHandshake size={22} color="#B91C1C" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-red-950">Build your safety circle</Text>
            <Muted className="mt-1">Your contacts receive your SOS message and location when an alert starts.</Muted>
          </View>
        </View>
      </Card>

      <View className="mb-3 mt-7 flex-row items-center justify-between">
        <View>
          <SectionTitle>Your contacts</SectionTitle>
          <Muted>{rows.length} saved contact{rows.length === 1 ? "" : "s"}</Muted>
        </View>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
          <Text className="text-base font-extrabold text-slate-700">{rows.length}</Text>
        </View>
      </View>

      {loading ? <Loading label="Loading contacts…" /> : null}
      {!loading && rows.length === 0 ? (
        <Card className="items-center border-dashed border-slate-300 bg-white py-8">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Plus size={25} color="#475569" />
          </View>
          <Text className="mt-4 text-lg font-extrabold text-slate-950">No contacts yet</Text>
          <Muted className="mt-1 max-w-xs text-center">Add one trusted person below to make SOS alerts useful.</Muted>
        </Card>
      ) : null}

      <View className="gap-3">
        {rows.map((c) => (
          <Card key={c.id}>
            <View className="flex-row items-start gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-slate-900">
                <Text className="text-lg font-extrabold text-white">{c.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-extrabold text-slate-950">{c.name}</Text>
                <Text className="mt-0.5 text-sm font-medium text-slate-500">{c.phone}{c.relationship ? ` · ${c.relationship}` : ""}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${c.name}`}
                onPress={() => {
                  setEditing(c);
                  setName(c.name);
                  setPhone(c.phone);
                  setRelationship(c.relationship ?? "");
                }}
                style={{ padding: 8 }}
              >
                <Edit3 size={19} color="#475569" />
              </Pressable>
            </View>
            <View className="mt-4 flex-row gap-2">
              <Btn title="Call" variant="primary" className="flex-1" accessibilityLabel={`Call ${c.name}`} onPress={() => callNumber(c.phone)} />
              <Btn title="Share" variant="outline" className="flex-1" accessibilityLabel={`Share location with ${c.name}`} loading={busy} onPress={share} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${c.name}`}
              onPress={() => del(c)}
              style={{ marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 6 }}
            >
              <Trash2 size={15} color="#B91C1C" />
              <Text className="text-sm font-bold text-red-700">Remove contact</Text>
            </Pressable>
          </Card>
        ))}
      </View>

      <View className="mb-3 mt-7">
        <SectionTitle>{editing ? "Edit contact" : "Add a contact"}</SectionTitle>
        <Muted className="mt-1">Use a number that can receive texts and calls.</Muted>
      </View>
      <Card className="gap-4">
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Mom" autoCapitalize="words" />
        <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="e.g. +1 555 0100" keyboardType="phone-pad" />
        <Field label="Relationship (optional)" value={relationship} onChangeText={setRelationship} placeholder="e.g. Parent" autoCapitalize="words" />
        <Btn title={editing ? "Save changes" : "Add emergency contact"} variant="danger" loading={busy} onPress={save} />
        {editing ? <Btn title="Cancel editing" variant="ghost" onPress={reset} /> : null}
      </Card>

      <View className="mb-2 mt-5 flex-row items-center justify-center gap-2">
        <Share2 size={15} color="#64748B" />
        <Text className="text-center text-xs font-medium text-slate-500">You can share your location with a contact at any time.</Text>
      </View>
    </Screen>
  );
}
