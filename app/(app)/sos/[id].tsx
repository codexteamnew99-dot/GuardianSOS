import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, Clock3, MapPin, Phone, Radio, Share2, ShieldAlert } from "lucide-react-native";
import type * as Loc from "expo-location";
import { Banner, Btn, Card, Loading, Muted, SectionTitle } from "../../../components/Ui";
import { SosMap } from "../../../components/SosMap";
import { errMsg, supabase } from "../../../lib/supabase";
import { pushLocation, resolveSos } from "../../../lib/sos";
import { watchFix, type Fix } from "../../../lib/location";
import { emergencyMessage, shareLocation } from "../../../lib/share";
import {
  alertEmergencyContacts,
  callAllContacts,
  callBanner,
  dialPrimaryContact,
  loadEmergencyContacts,
  sendEmergencySMS,
  smsBanner,
  type CallResult,
  type SmsResult,
} from "../../../lib/emergencyAlert";
import type { EmergencyContact, SosEvent } from "../../../lib/types";

export default function ActiveSos() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<SosEvent | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [trail, setTrail] = useState<{ lat: number; lng: number }[]>([]);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [sms, setSms] = useState<SmsResult | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);
  const [call, setCall] = useState<CallResult | null>(null);
  const [callLoading, setCallLoading] = useState(false);
  const [callProgress, setCallProgress] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);
  const watcher = useRef<Loc.LocationSubscription | null>(null);
  const contactAlertedRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const applyAlertResult = (smsRes: SmsResult, callRes: CallResult, rows?: EmergencyContact[]) => {
    setSms(smsRes);
    setCall(callRes);
    if (rows) setContacts(rows);
  };

  const onCallProgress = useCallback((dialed: number, total: number, name: string) => {
    setCallProgress(`Calling ${name} (${dialed + 1} of ${total})…`);
  }, []);

  const runContactAlert = useCallback(async (ev: SosEvent, force = false) => {
    if (!force && contactAlertedRef.current === ev.id) return;
    contactAlertedRef.current = ev.id;
    const lat = ev.lat;
    const lng = ev.lng;
    if (lat == null || lng == null) {
      applyAlertResult(
        { path: null, sent: 0, failed: 0, error: "No GPS fix yet — SMS was not sent." },
        { path: null, dialed: 0, total: 0, error: "No GPS fix yet — a call was not placed." },
      );
      return;
    }
    setSmsLoading(true);
    setCallLoading(true);
    try {
      const result = await alertEmergencyContacts(ev.user_id, ev.id, lat, lng, { force, onCallProgress });
      if (result.skipped) return;
      applyAlertResult(result.sms, result.call, result.contacts);
    } catch (e) {
      applyAlertResult(
        { path: null, sent: 0, failed: 0, error: errMsg(e) },
        { path: null, dialed: 0, total: 0, error: errMsg(e) },
      );
    } finally {
      setSmsLoading(false);
      setCallLoading(false);
      setCallProgress(null);
    }
  }, [onCallProgress]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: e } = await supabase.from("sos_events").select("*").eq("id", id).single();
        if (e) throw e;
        if (cancelled) return;
        const ev = data as SosEvent;
        setEvent(ev);
        if (ev.lat != null && ev.lng != null) {
          setFix({ lat: ev.lat, lng: ev.lng, accuracy: ev.accuracy });
          setTrail([{ lat: ev.lat, lng: ev.lng }]);
          setLastAt(new Date(ev.started_at).getTime());
        }
        if (fresh === "1" && ev.status === "ACTIVE") void runContactAlert(ev);
        const rows = await loadEmergencyContacts(ev.user_id).catch(() => [] as EmergencyContact[]);
        if (!cancelled) setContacts(rows);
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    })();
    return () => { cancelled = true; };
  }, [id, fresh, runContactAlert]);

  useEffect(() => {
    if (!event || event.status !== "ACTIVE") return;
    let stopped = false;
    watchFix(
      async (f) => {
        if (stopped) return;
        setFix(f);
        setTrail((t) => [...t.slice(-99), { lat: f.lat, lng: f.lng }]);
        try {
          await pushLocation(event.id, f);
          setLastAt(Date.now());
        } catch (e) {
          setError(errMsg(e));
        }
      },
      (e) => setError(errMsg(e)),
    ).then((sub) => {
      if (stopped) sub?.remove();
      else watcher.current = sub;
    });
    return () => {
      stopped = true;
      watcher.current?.remove();
      watcher.current = null;
    };
  }, [event?.id, event?.status]);

  const onShare = async () => {
    if (!fix) return setError("No location yet — wait for a GPS fix.");
    try {
      await shareLocation(fix.lat, fix.lng);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const retrySms = async () => {
    if (!event || event.lat == null || event.lng == null) {
      setSms({ path: null, sent: 0, failed: 0, error: "No GPS fix yet — SMS was not sent." });
      return;
    }
    setSmsLoading(true);
    try {
      const rows = contacts.length ? contacts : await loadEmergencyContacts(event.user_id);
      setContacts(rows);
      setSms(await sendEmergencySMS(rows, emergencyMessage(event.lat, event.lng)));
    } catch (e) {
      setSms({ path: null, sent: 0, failed: 0, error: errMsg(e) });
    } finally {
      setSmsLoading(false);
    }
  };

  const retryCalls = async () => {
    if (!event) return;
    const rows = contacts.length ? contacts : await loadEmergencyContacts(event.user_id).catch(() => []);
    if (rows.length === 0) {
      setCall({ path: null, dialed: 0, total: 0, error: "No emergency contact to call." });
      return;
    }
    setContacts(rows);
    setCallLoading(true);
    try {
      setCall(await callAllContacts(rows, onCallProgress));
    } catch (e) {
      setCall({ path: "tel", name: rows[0].name, dialed: 0, total: rows.length, error: errMsg(e) });
    } finally {
      setCallLoading(false);
      setCallProgress(null);
    }
  };

  const onCallContact = async (c: EmergencyContact) => {
    setCallingId(c.id);
    try {
      const res = await dialPrimaryContact(c.phone, c.name);
      if (res.error) setCall(res);
    } catch (e) {
      setCall({ path: "tel", name: c.name, dialed: 0, total: 1, error: errMsg(e) });
    } finally {
      setCallingId(null);
    }
  };

  const doResolve = async () => {
    if (!event) return;
    setResolving(true);
    setError(null);
    try {
      watcher.current?.remove();
      watcher.current = null;
      const updated = await resolveSos(event.id);
      setEvent(updated);
      router.replace("/home");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setResolving(false);
    }
  };

  const onResolve = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm("Resolve this SOS? Location sharing will stop.")) void doResolve();
      return;
    }
    Alert.alert("Resolve this SOS?", "Location sharing stops and the emergency screen closes.", [
      { text: "Cancel", style: "cancel" },
      { text: "Resolve", style: "destructive", onPress: () => void doResolve() },
    ]);
  };

  const secondsAgo = lastAt ? Math.max(0, Math.round((Date.now() - lastAt) / 1000)) : null;
  const smsUi = smsBanner(sms, smsLoading);
  const callUi = callBanner(call, callLoading, callProgress);
  const remaining = Platform.OS === "web" ? contacts : contacts.slice(1);

  if (!event) {
    return (
      <View className="flex-1 bg-slate-50 px-5 pt-24">
        {error ? <Banner kind="error" text={error} /> : <Loading label="Opening emergency screen…" />}
      </View>
    );
  }

  const isActive = event.status === "ACTIVE";
  return (
    <View className="flex-1 bg-slate-50">
      <View className={`px-5 pb-5 pt-12 ${isActive ? "bg-red-700" : "bg-slate-800"}`}>
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to home"
            onPress={() => router.replace("/home")}
            android_ripple={{ color: "rgba(255,255,255,0.25)", borderless: true, radius: 21 }}
            style={{ height: 42, width: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(255,255,255,0.18)" }}
          >
            <ArrowLeft size={21} color="#FFFFFF" />
          </Pressable>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Radio size={18} color="#FFFFFF" />
              <Text className="text-xs font-bold uppercase tracking-widest text-red-100">Emergency mode</Text>
            </View>
            <Text className="mt-1 text-2xl font-extrabold text-white">{isActive ? "SOS is active" : "SOS resolved"}</Text>
            <Text className="mt-1 text-sm leading-5 text-red-100">{isActive ? "Stay calm. We’re keeping your location updated." : "Location sharing has stopped."}</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40, paddingTop: 16, gap: 12 }}>
        {error ? <Banner kind="error" text={error} /> : null}
        {smsUi.status !== "idle" ? <Banner kind={smsUi.status === "error" ? "warn" : smsUi.status === "loading" ? "info" : "success"} text={smsUi.message} /> : null}
        {smsUi.status === "error" && isActive ? <Btn title="Retry SMS alert" variant="outline" loading={smsLoading} onPress={retrySms} /> : null}
        {callUi.status !== "idle" ? <Banner kind={callUi.status === "error" ? "warn" : callUi.status === "loading" ? "info" : "success"} text={callUi.message} /> : null}
        {callUi.status === "error" && isActive ? <Btn title="Retry calls" variant="outline" loading={callLoading} onPress={retryCalls} /> : null}

        <Card className="p-3">
          <View className="mb-3 flex-row items-center gap-3 px-2 pt-1">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-red-100"><MapPin size={20} color="#B91C1C" /></View>
            <View className="flex-1"><Text className="text-base font-extrabold text-slate-950">Your live location</Text><Muted>{secondsAgo == null ? "Waiting for a GPS fix…" : `Updated ${secondsAgo}s ago`}</Muted></View>
            {isActive ? <View className="rounded-full bg-emerald-100 px-3 py-1"><Text className="text-xs font-extrabold text-emerald-800">LIVE</Text></View> : null}
          </View>
          <SosMap lat={fix?.lat ?? null} lng={fix?.lng ?? null} trail={trail} label="You are here" height={240} />
          <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3">
            <Clock3 size={16} color="#64748B" />
            <Text className="flex-1 text-sm font-semibold text-slate-600">{fix ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}${fix.accuracy ? ` ±${Math.round(fix.accuracy)}m` : ""}` : "Waiting for location…"}</Text>
          </View>
        </Card>

        <Card>
          <View className="flex-row items-start gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100"><CheckCircle2 size={22} color="#15803D" /></View>
            <View className="flex-1"><SectionTitle>What happens next</SectionTitle><Muted className="mt-1">Your contacts are being alerted. Keep this screen open so your location can continue updating.</Muted></View>
          </View>
        </Card>

        {isActive && remaining.length > 0 ? (
          <Card className="gap-3">
            <View className="flex-row items-center gap-3"><Phone size={20} color="#0F172A" /><View className="flex-1"><SectionTitle>{Platform.OS === "web" ? "Call your contacts" : "Call contacts again"}</SectionTitle><Muted>{Platform.OS === "web" ? "Choose a contact to open your device dialer." : "Tap any contact to call them again."}</Muted></View></View>
            {remaining.map((c) => <Btn key={c.id} title={`Call ${c.name}`} variant="primary" loading={callingId === c.id} onPress={() => void onCallContact(c)} />)}
          </Card>
        ) : null}

        <View className="gap-3">
          <Btn title="Share my location" variant="outline" onPress={() => void onShare()} accessibilityLabel="Share my current location" />
          {isActive ? <Btn title="Resolve SOS" variant="danger" loading={resolving} onPress={onResolve} /> : <Btn title="Back to home" variant="ghost" onPress={() => router.replace("/home")} />}
        </View>
        <View className="flex-row items-center justify-center gap-2 py-2"><ShieldAlert size={15} color="#94A3B8" /><Text className="text-center text-xs font-medium text-slate-400">Only resolve the SOS when you are safe.</Text><Share2 size={15} color="#94A3B8" /></View>
      </ScrollView>
    </View>
  );
}
