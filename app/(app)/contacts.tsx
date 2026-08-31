import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Banner, Btn, Card, Field, H1, Loading, Muted, Screen } from "../../components/Ui";
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const reset = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setRelationship("");
  };
  const save = async () => {
    setError(null);
    setOk(null);
    if (!userId) return setError("Session expired. Sign in again.");
    if (!name.trim() || !phone.trim()) return setError("Name and phone are required.");
    setBusy(true);
    try {
      const payload = { name: name.trim(), phone: phone.trim(), relationship: relationship.trim() || null };
      const { error: e } = editing
        ? await supabase.from("emergency_contacts").update(payload).eq("id", editing.id)
        : await supabase.from("emergency_contacts").insert({ ...payload, user_id: userId });
      if (e) throw e;
      setOk(editing ? "Contact updated." : "Contact added.");
      reset();
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const del = (c: EmergencyContact) =>
    Alert.alert("Delete contact?", c.name, [
      { text: "CANCEL", style: "cancel" },
      {
        text: "DELETE",
        style: "destructive",
        onPress: async () => {
          try {
            const { error: e } = await supabase.from("emergency_contacts").delete().eq("id", c.id);
            if (e) throw e;
            await load();
          } catch (e) {
            setError(errMsg(e));
          }
        },
      },
    ]);

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
      <View className="mt-4 flex-row items-center gap-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-full bg-slate-100">
          <ChevronLeft size={22} color="#0F172A" />
        </Pressable>
        <H1>Emergency contacts</H1>
      </View>

      <View className="mt-4 gap-3">
        {error ? <Banner kind="error" text={error} /> : null}
        {ok ? <Banner kind="success" text={ok} /> : null}
      </View>

      {loading ? <Loading /> : null}
      {!loading && rows.length === 0 ? <Muted className="mt-4">No contacts yet.</Muted> : null}

      <View className="mt-4 gap-2">
        {rows.map((c) => (
          <Card key={c.id} className="gap-2">
            <Text className="text-base font-semibold text-slate-900">{c.name}</Text>
            <Muted>{c.phone}{c.relationship ? ` · ${c.relationship}` : ""}</Muted>
            <View className="flex-row gap-2">
              <Btn title="Call" variant="primary" className="flex-1" onPress={() => callNumber(c.phone)} />
              <Btn title="Share location" variant="outline" className="flex-1" loading={busy} onPress={share} />
            </View>
            <View className="flex-row gap-2">
              <Btn
                title="Edit"
                variant="ghost"
                className="flex-1"
                onPress={() => {
                  setEditing(c);
                  setName(c.name);
                  setPhone(c.phone);
                  setRelationship(c.relationship ?? "");
                }}
              />
              <Btn title="Delete" variant="ghost" className="flex-1" onPress={() => del(c)} />
            </View>
          </Card>
        ))}
      </View>

      <View className="mt-6 gap-3">
        <Text className="text-lg font-bold text-slate-900">{editing ? "Edit contact" : "Add contact"}</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Mom" autoCapitalize="words" />
        <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+1 555 0100" keyboardType="phone-pad" />
        <Field label="Relationship (optional)" value={relationship} onChangeText={setRelationship} placeholder="Mother" autoCapitalize="words" />
        <Btn title={editing ? "SAVE CHANGES" : "ADD CONTACT"} variant="danger" loading={busy} onPress={save} />
        {editing ? <Btn title="Cancel" variant="ghost" onPress={reset} /> : null}
      </View>
    </Screen>
  );
}


