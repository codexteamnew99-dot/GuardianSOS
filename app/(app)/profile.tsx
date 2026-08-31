import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ChevronLeft } from "lucide-react-native";
import { Banner, Btn, Card, Field, H1, Muted, Screen } from "../../components/Ui";
import { useAuth } from "../../lib/auth";
import { errMsg, supabase } from "../../lib/supabase";
import { permissionStatus, ensureLocationPermission } from "../../lib/location";
import { notificationPermissionStatus, registerPushToken } from "../../lib/push";

export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [photo, setPhoto] = useState(profile?.photo_url ?? "");
  const [locPerm, setLocPerm] = useState("checking…");
  const [notifPerm, setNotifPerm] = useState("checking…");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refreshPerms = useCallback(async () => {
    setLocPerm(await permissionStatus());
    setNotifPerm(await notificationPermissionStatus());
  }, []);

  useEffect(() => {
    refreshPerms();
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

  const enableNotifications = async () => {
    setError(null);
    if (!session?.user) return;
    try {
      await registerPushToken(session.user.id);
      setOk("Push notifications ready on this device.");
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
        <Text className="text-lg font-bold text-slate-900">Permissions</Text>
        <Card className="gap-2">
          <Muted>Location: {locPerm}</Muted>
          {locPerm !== "granted" ? <Btn title="Enable location" variant="outline" onPress={enableLocation} /> : null}
        </Card>
        <Card className="gap-2">
          <Muted>Notifications: {notifPerm}</Muted>
          <Btn title="Enable / refresh push" variant="outline" onPress={enableNotifications} />
        </Card>
      </View>

      <View className="mt-6">
        <Btn title="LOG OUT" variant="ghost" onPress={() => signOut().then(() => router.replace("/sign-in"))} />
      </View>
    </Screen>
  );
}


