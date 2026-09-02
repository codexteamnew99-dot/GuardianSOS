import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ChevronLeft } from "lucide-react-native";
import { Banner, Btn, Card, Field, H1, Muted, Screen } from "../../components/Ui";
import { useAuth } from "../../lib/auth";
import { errMsg, supabase } from "../../lib/supabase";
import { permissionStatus, ensureLocationPermission } from "../../lib/location";
import { ensureEmergencyPermissions, emergencyPermissionStatus } from "../../lib/emergencyAlert";
import { getShakeToSosEnabled, setShakeToSosEnabled } from "../../lib/settings";

export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [photo, setPhoto] = useState(profile?.photo_url ?? "");
  const [locPerm, setLocPerm] = useState("checking…");
  const [commsPerm, setCommsPerm] = useState("checking…");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [shakeToSos, setShakeToSos] = useState(true);

  const refreshPerms = useCallback(async () => {
    setLocPerm(await permissionStatus());
    setCommsPerm(await emergencyPermissionStatus());
  }, []);

  useEffect(() => {
    refreshPerms();
    getShakeToSosEnabled().then(setShakeToSos);
  }, [refreshPerms]);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setPhoto(profile?.photo_url ?? "");
  }, [profile?.id, profile?.full_name, profile?.phone, profile?.photo_url]);

  const pickPhoto = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };
  const save = async () => {
    setError(null);
    setOk(null);
    if (!session?.user) return setError("Session expired. Sign in again.");
    if (!fullName.trim()) return setError("Name is required.");
    setBusy(true);
    try {
      const { error: e } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null, photo_url: photo || null })
        .eq("id", session.user.id);
      if (e) throw e;
      await refreshProfile();
      setOk("Profile saved.");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const enableLocation = async () => {
    setError(null);
    try {
      await ensureLocationPermission();
      setOk("Location permission granted.");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      refreshPerms();
    }
  };

  const enableComms = async () => {
    setError(null);
    try {
      const res = await ensureEmergencyPermissions();
      setOk(
        res.sms && res.call
          ? "SMS + calling ready — SOS will alert contacts without asking again."
          : "Some access was denied. SOS will fall back to the SMS composer and the dialer."
      );
    } catch (e) {
      setError(errMsg(e));
    } finally {
      refreshPerms();
    }
  };
  return (
    <Screen>
      <View className="mt-4 flex-row items-center gap-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-full bg-slate-100">
          <ChevronLeft size={22} color="#0F172A" />
        </Pressable>
        <H1>Profile</H1>
      </View>

      <View className="mt-4 gap-3">
        {error ? <Banner kind="error" text={error} /> : null}
        {ok ? <Banner kind="success" text={ok} /> : null}
      </View>

      <View className="mt-4 items-center gap-3">
        <Pressable accessibilityRole="button" accessibilityLabel="Change photo" onPress={pickPhoto}>
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: 96, height: 96, borderRadius: 48 }} />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-full bg-slate-200">
              <Text className="text-2xl font-bold text-slate-500">{(fullName || "?").slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
        </Pressable>
        <Muted>Tap the photo to change it</Muted>
      </View>

      <View className="mt-6 gap-4">
        <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Alex Doe" autoCapitalize="words" />
        <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+1 555 0100" keyboardType="phone-pad" />
        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-slate-700">Email</Text>
          <Text className="text-lg text-slate-500">{session?.user?.email ?? "—"}</Text>
        </View>
        <Btn title="SAVE" variant="danger" loading={busy} onPress={save} />
      </View>

      <View className="mt-6 gap-3">
        <Text className="text-lg font-bold text-slate-900">Settings</Text>
        <Card>
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-semibold text-slate-900">Shake to trigger SOS</Text>
              <Muted>Two quick shakes open the SOS confirmation</Muted>
            </View>
            <Switch
              accessibilityLabel="Shake to trigger SOS"
              value={shakeToSos}
              onValueChange={(on) => {
                setShakeToSos(on);
                setShakeToSosEnabled(on);
              }}
              trackColor={{ false: "#CBD5E1", true: "#FECACA" }}
              thumbColor={shakeToSos ? "#DC2626" : "#F8FAFC"}
            />
          </View>
        </Card>
      </View>

      <View className="mt-6 gap-3">
        <Text className="text-lg font-bold text-slate-900">Permissions</Text>
        <Card className="gap-2">
          <Muted>Location: {locPerm}</Muted>
          {locPerm !== "granted" ? <Btn title="Enable location" variant="outline" onPress={enableLocation} /> : null}
        </Card>
        <Card className="gap-2">
          <Muted>SMS + calling: {commsPerm}</Muted>
          <Btn title="Grant SMS + call access" variant="outline" onPress={enableComms} />
        </Card>
      </View>

      <View className="mt-6">
        <Btn title="LOG OUT" variant="ghost" onPress={() => signOut().then(() => router.replace("/sign-in"))} />
      </View>
    </Screen>
  );
}


