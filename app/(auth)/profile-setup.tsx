import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ShieldCheck, UserRound } from "lucide-react-native";
import { Banner, Btn, Card, Field, Muted, Screen } from "../../components/Ui";
import { useAuth } from "../../lib/auth";
import { errMsg, supabase } from "../../lib/supabase";

export default function ProfileSetup() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!fullName.trim()) return setError("Add your name so contacts can identify you in an alert.");
    if (!session?.user) return setError("Your session expired. Please sign in again.");
    setBusy(true);
    try {
      const { error: e } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null, email: session.user.email })
        .eq("id", session.user.id);
      if (e) throw e;
      await refreshProfile();
      router.replace("/home");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="mb-7 mt-10 items-center">
        <View className="h-16 w-16 items-center justify-center rounded-3xl bg-red-600">
          <UserRound size={32} color="#FFFFFF" />
        </View>
        <Text className="mt-5 text-center text-3xl font-extrabold tracking-tight text-slate-950">Almost ready</Text>
        <Muted className="mt-2 max-w-sm text-center">Add a few details so your safety circle knows who is sending an alert.</Muted>
      </View>

      <Card className="gap-5">
        <View className="flex-row items-center gap-3 rounded-2xl bg-emerald-50 p-4">
          <ShieldCheck size={22} color="#15803D" />
          <Text className="flex-1 text-sm font-semibold leading-5 text-emerald-800">Your details stay private and are used to identify you to your emergency contacts.</Text>
        </View>
        {error ? <Banner kind="error" text={error} /> : null}
        <Field label="Your full name" value={fullName} onChangeText={setFullName} placeholder="e.g. Alex Doe" autoCapitalize="words" />
        <Field label="Your phone number (optional)" value={phone} onChangeText={setPhone} placeholder="e.g. +1 555 0100" keyboardType="phone-pad" />
        <Btn title="Continue to GuardianSOS" variant="danger" loading={busy} onPress={save} />
      </Card>

      <View className="mt-5">
        <Btn title="Sign out" variant="ghost" onPress={() => void signOut().then(() => router.replace("/sign-in"))} />
      </View>
    </Screen>
  );
}
