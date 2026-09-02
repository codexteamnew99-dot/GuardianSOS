import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type * as Loc from "expo-location";
import { Banner, Btn, Card, Loading, Muted } from "../../../components/Ui";
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
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const applyAlertResult = (smsRes: SmsResult, callRes: CallResult, rows?: EmergencyContact[]) => {
    setSms(smsRes);
    setCall(callRes);
    if (rows) setContacts(rows);
  };

  const onCallProgress = useCallback((dialed: number, total: number, name: string) => {
    setCallProgress(`Calling ${name} (${dialed + 1} of ${total})…`);
  }, []);

  const runContactAlert = useCallback(
    async (ev: SosEvent, force = false) => {
      if (!force && contactAlertedRef.current === ev.id) return;
      contactAlertedRef.current = ev.id;
      const lat = ev.lat;
      const lng = ev.lng;
      if (lat == null || lng == null) {
        applyAlertResult(
          { path: null, sent: 0, failed: 0, error: "No GPS yet — SMS not sent." },
          { path: null, dialed: 0, total: 0, error: "No GPS yet — call not placed." }
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
          { path: null, dialed: 0, total: 0, error: errMsg(e) }
        );
      } finally {
        setSmsLoading(false);
        setCallLoading(false);
        setCallProgress(null);
      }
    },
    [onCallProgress]
  );

  // load event + contacts; SMS and the call queue fire in parallel on a freshly created SOS
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

  // live location while ACTIVE
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
      (e) => setError(errMsg(e))
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
      setSms({ path: null, sent: 0, failed: 0, error: "No GPS yet — SMS not sent." });
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
    const rows = contacts.length ? contacts : await loadEmergencyContacts(event!.user_id).catch(() => []);
    if (rows.length === 0) {
      setCall({ path: null, dialed: 0, total: 0, error: "No emergency contact to call." });
      return;
    }
    setContacts(rows);
    setCallLoading(true);
    try {
      setCall(await callAllContacts(rows, onCallProgress));
    } catch (e) {
      setCall({ path: null, name: rows[0].name, dialed: 0, total: rows.length, error: errMsg(e) });
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
      Alert.alert("SOS resolved", "Location sharing has stopped.", [
        { text: "OK", onPress: () => router.replace("/home") },
      ]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setResolving(false);
    }
  };

  const onResolve = () =>
    Alert.alert("Resolve this SOS?", "Location sharing stops and the emergency screen closes.", [
      { text: "CANCEL", style: "cancel" },
      { text: "RESOLVE", style: "destructive", onPress: doResolve },
    ]);

  const secondsAgo = lastAt ? Math.max(0, Math.round((Date.now() - lastAt) / 1000)) : null;
  const smsUi = smsBanner(sms, smsLoading);
  const callUi = callBanner(call, callLoading, callProgress);
  // On web nothing is auto-dialed, so every contact needs its own button.
  const remaining = Platform.OS === "web" ? contacts : contacts.slice(1);

  if (!event) {
    return (
      <View className="flex-1 bg-white pt-24">
        {error ? <View className="px-5"><Banner kind="error" text={error} /></View> : <Loading label="Opening emergency screen…" />}
      </View>
    );
  }
  const isActive = event.status === "ACTIVE";
  return (
    <View className="flex-1 bg-white">
      <View className={`px-5 pb-4 pt-14 ${isActive ? "bg-red-600" : "bg-slate-800"}`}>
        <Text className="text-2xl font-extrabold text-white">{isActive ? "SOS ACTIVE" : "SOS RESOLVED"}</Text>
        <Text className="mt-1 text-base text-red-50">
          {isActive ? "Your emergency contacts have been alerted" : "Location sharing has stopped"}
        </Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
        {error ? <Banner kind="error" text={error} /> : null}

        {smsUi.status !== "idle" ? (
          <Banner
            kind={smsUi.status === "error" ? "warn" : smsUi.status === "loading" ? "info" : "success"}
            text={smsUi.message}
          />
        ) : null}
        {smsUi.status === "error" && isActive ? (
          <Btn title="RETRY SMS" variant="outline" loading={smsLoading} onPress={retrySms} />
        ) : null}

        {callUi.status !== "idle" ? (
          <Banner
            kind={callUi.status === "error" ? "warn" : callUi.status === "loading" ? "info" : "success"}
            text={callUi.message}
          />
        ) : null}
        {callUi.status === "error" && isActive ? (
          <Btn title="RETRY CALLS" variant="outline" loading={callLoading} onPress={retryCalls} />
        ) : null}

        <SosMap lat={fix?.lat ?? null} lng={fix?.lng ?? null} trail={trail} label="You are here" height={240} />

        <Card>
          <Muted>{secondsAgo == null ? "Waiting for first update" : `Last updated ${secondsAgo}s ago`}</Muted>
          <Text className="mt-1 text-base text-slate-900">
            {fix ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}${fix.accuracy ? ` ±${Math.round(fix.accuracy)}m` : ""}` : "—"}
          </Text>
        </Card>

        {isActive && remaining.length > 0 ? (
          <Card className="gap-2">
            <Text className="text-base font-semibold text-slate-900">
              {Platform.OS === "web" ? "Call contacts" : "Call other contacts"}
            </Text>
            <Muted>
              {Platform.OS === "web"
                ? "Tap a contact to open your dialer."
                : "Contacts are dialed one after another automatically. Tap to call anyone again."}
            </Muted>
            {remaining.map((c) => (
              <Btn
                key={c.id}
                title={`Call ${c.name}`}
                variant="primary"
                loading={callingId === c.id}
                onPress={() => onCallContact(c)}
              />
            ))}
          </Card>
        ) : null}

        <View className="gap-3">
          <Btn title="SHARE LOCATION" variant="outline" onPress={onShare} />
          {isActive ? (
            <Btn title="RESOLVE SOS" variant="danger" loading={resolving} onPress={onResolve} />
          ) : (
            <Btn title="BACK TO HOME" variant="ghost" onPress={() => router.replace("/home")} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
