import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, CheckCircle2, LogOut, ShieldCheck, UserRound } from "lucide-react-native";
import { Banner, Btn, Card, Field, IconButton, Muted, PageHeader, Screen, SectionTitle } from "../../components/Ui";
import { useAuth } from "../../lib/auth";
import { errMsg, supabase } from "../../lib/supabase";
import { permissionStatus, ensureLocationPermission } from "../../lib/location";
import { ensureEmergencyPermissions, emergencyPermissionStatus } from "../../lib/emergencyAlert";
import { getShakeToSosEnabled, setShakeToSosEnabled } from "../../lib/settings";

function PermissionRow({ label, value, onEnable }: { label: string; value: string; onEnable: () => void }) {
  const granted = value === "granted";
  return (
    <View className="flex-row items-center gap-3">
      <View className={`h-10 w-10 items-center justify-center rounded-full ${granted ? "bg-emerald-100" : "bg-amber-100"}`}>
        {granted ? <CheckCircle2 size={19} color="#15803D" /> : <ShieldCheck size={19} color="#A16207" />}
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-slate-950">{label}</Text>
        <Text className="mt-0.5 text-sm text-slate-500">{value}</Text>
      </View>
      {!granted ? <Btn title="Enable" variant="outline" onPress={onEnable} /> : null}
    </View>
  );
}

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
    void refreshPerms();
    void getShakeToSosEnabled().then(setShakeToSos);
  }, [refreshPerms]);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setPhoto(profile?.photo_url ?? "");
  }, [profile?.id, profile?.full_name, profile?.phone, profile?.photo_url]);

  const pickPhoto = async () => {
    setError(null);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5 });
      if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const save = async () => {
    setError(null);
    setOk(null);
    if (!session?.user) return setError("Your session expired. Please sign in again.");
    if (!fullName.trim()) return setError("Add your name so contacts know who needs help.");
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
      void refreshPerms();
    }
  };

  const enableComms = async () => {
    setError(null);
    try {
      const res = await ensureEmergencyPermissions();
      setOk(res.sms && res.call ? "SMS and calling are ready." : "Some access was denied. SOS will use browser fallbacks where available.");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      void refreshPerms();
    }
  };

  return (
    <Screen>
      <PageHeader title="Profile & settings" subtitle="Keep your account and safety tools ready." onBack={() => router.back()} />
      {error ? <View className="mb-3"><Banner kind="error" text={error} /></View> : null}
      {ok ? <View className="mb-3"><Banner kind="success" text={ok} /></View> : null}

      <Card className="items-center bg-slate-900">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          onPress={pickPhoto}
          style={{ position: "relative" }}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: "#FFFFFF" }} />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-full bg-slate-700">
              {fullName ? <Text className="text-3xl font-extrabold text-white">{fullName.slice(0, 1).toUpperCase()}</Text> : <UserRound size={35} color="#FFFFFF" />}
            </View>
          )}
          <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-red-600">
            <Camera size={15} color="#FFFFFF" />
          </View>
        </Pressable>
        <Text className="mt-4 text-xl font-extrabold text-white">{fullName || "Your profile"}</Text>
        <Text className="mt-1 text-sm text-slate-300">{session?.user?.email ?? ""}</Text>
      </Card>

      <View className="mb-3 mt-7"><SectionTitle>Personal details</SectionTitle><Muted className="mt-1">This information helps contacts identify you.</Muted></View>
      <Card className="gap-4">
        <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="e.g. Alex Doe" autoCapitalize="words" />
        <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="e.g. +1 555 0100" keyboardType="phone-pad" />
        <View className="gap-1.5">
          <Text className="text-sm font-bold text-slate-700">Email</Text>
          <Text className="text-base text-slate-500">{session?.user?.email ?? "—"}</Text>
        </View>
        <Btn title="Save profile" variant="danger" loading={busy} onPress={save} />
      </Card>

      <View className="mb-3 mt-7"><SectionTitle>Safety preferences</SectionTitle><Muted className="mt-1">Choose how GuardianSOS helps you get ready.</Muted></View>
      <Card>
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-red-50"><ShieldCheck size={22} color="#DC2626" /></View>
          <View className="flex-1 pr-3">
            <Text className="text-base font-extrabold text-slate-950">Shake to trigger SOS</Text>
            <Muted className="mt-1">Two quick shakes open the SOS confirmation.</Muted>
          </View>
          <Switch
            accessibilityLabel="Shake to trigger SOS"
            value={shakeToSos}
            onValueChange={(on) => {
              setShakeToSos(on);
              void setShakeToSosEnabled(on);
            }}
            trackColor={{ false: "#CBD5E1", true: "#FECACA" }}
            thumbColor={shakeToSos ? "#DC2626" : "#F8FAFC"}
          />
        </View>
      </Card>

      <View className="mb-3 mt-7"><SectionTitle>Permissions</SectionTitle><Muted className="mt-1">These let SOS get your location and contact your safety circle.</Muted></View>
      <Card className="gap-5">
        <PermissionRow label="Location" value={locPerm} onEnable={enableLocation} />
        <View className="h-px bg-slate-100" />
        <PermissionRow label="SMS and calling" value={commsPerm} onEnable={enableComms} />
      </Card>

      <View className="mt-7">
        <Btn title="Log out" variant="ghost" onPress={() => void signOut().then(() => router.replace("/sign-in"))} accessibilityLabel="Log out of GuardianSOS" />
      </View>
      <View className="mb-2 mt-4 flex-row items-center justify-center gap-2"><LogOut size={14} color="#94A3B8" /><Text className="text-xs text-slate-400">You can update these settings at any time.</Text></View>
    </Screen>
  );
}
