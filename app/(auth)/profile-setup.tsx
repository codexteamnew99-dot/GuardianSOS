import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Banner, Btn, Field, H1, Muted, Screen } from "../../components/Ui";
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
    if (!fullName.trim()) return setError("Your name is required — contacts see it in the alert.");
    if (!session?.user) return setError("Your session expired. Sign in again.");
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
      <View className="mt-14 gap-2">
        <H1>Finish your profile</H1>
        <Muted>Your emergency contacts see this name when you trigger an SOS.</Muted>
      </View>
      <View className="mt-8 gap-4">
        {error ? <Banner kind="error" text={error} /> : null}
        <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Alex Doe" autoCapitalize="words" />
        <Field label="Phone (optional)" value={phone} onChangeText={setPhone} placeholder="+1 555 0100" keyboardType="phone-pad" />
        <Btn title="Continue" variant="danger" loading={busy} onPress={save} />
        <Btn title="Sign out" variant="ghost" onPress={() => signOut().then(() => router.replace("/sign-in"))} />
      </View>
    </Screen>
  );
}
