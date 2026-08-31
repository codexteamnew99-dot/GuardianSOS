import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type * as Loc from "expo-location";
import { Banner, Btn, Card, Loading, Muted } from "../../../components/Ui";
import { SosMap } from "../../../components/SosMap";
import { useAuth } from "../../../lib/auth";
import { errMsg, supabase } from "../../../lib/supabase";
import { acceptedGuardians, notifyGuardians, pushLocation, resolveSos, type NotifyResult } from "../../../lib/sos";
import { watchFix, type Fix } from "../../../lib/location";
import { callNumber, shareLocation } from "../../../lib/share";
import type { SosEvent } from "../../../lib/types";

export default function ActiveSos() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const router = useRouter();
  const { session, profile } = useAuth();
  const [event, setEvent] = useState<SosEvent | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [trail, setTrail] = useState<{ lat: number; lng: number }[]>([]);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [notify, setNotify] = useState<NotifyResult | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardianPhone, setGuardianPhone] = useState<string | null>(null);
  const watcher = useRef<Loc.LocationSubscription | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const runNotify = useCallback(
    async (ev: SosEvent) => {
      setNotifying(true);
      try {
        setNotify(await notifyGuardians(ev, profile?.full_name || "Someone"));
      } catch (e) {
        setNotify({ guardians: 0, sent: 0, failed: 0, error: errMsg(e) });
      } finally {
        setNotifying(false);
      }
    },
    [profile?.full_name]
  );
  // load event + guardian phone; notify on a freshly created SOS
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
        if (fresh === "1" && ev.status === "ACTIVE") await runNotify(ev);

        const gs = await acceptedGuardians(ev.user_id);
        const ids = gs.map((g) => g.guardian_user_id!).filter(Boolean);
        let phone: string | null = gs.find((g) => g.invite_phone)?.invite_phone ?? null;
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("phone").in("id", ids).not("phone", "is", null);
          phone = (profs?.[0] as { phone?: string } | undefined)?.phone ?? phone;
        }
        if (!cancelled) setGuardianPhone(phone);
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    })();
    return () => { cancelled = true; };
  }, [id, fresh, runNotify]);

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

  const onCall = async () => {
    if (!guardianPhone) return setError("No guardian phone number saved. Add one in Guardians or Contacts.");
    await callNumber(guardianPhone);
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
      Alert.alert("SOS resolved", "Your guardians can see that you are safe.", [
        { text: "OK", onPress: () => router.replace("/home") },
      ]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setResolving(false);
    }
  };

  const onResolve = () =>
    Alert.alert("Resolve this SOS?", "Location sharing stops and your guardians are marked as informed.", [
      { text: "CANCEL", style: "cancel" },
      { text: "RESOLVE", style: "destructive", onPress: doResolve },
    ]);

  const secondsAgo = lastAt ? Math.max(0, Math.round((Date.now() - lastAt) / 1000)) : null;
  const notifyText = notifying
    ? "Notifying guardians…"
    : notify?.error
      ? `Guardians notification failed — ${notify.error}`
      : notify
        ? `${notify.sent} of ${notify.guardians} guardian device(s) notified`
        : null;

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
          {isActive ? "Your guardians can see your live location" : "Location sharing has stopped"}
        </Text>
      </View>

      <View className="flex-1 gap-3 px-5 pt-4">
        {error ? <Banner kind="error" text={error} /> : null}
        {notifyText ? (
          <Banner kind={notify?.error ? "warn" : "success"} text={notifyText} />
        ) : null}
        {notify?.error && isActive ? (
          <Btn title="RETRY GUARDIAN ALERT" variant="outline" loading={notifying} onPress={() => runNotify(event)} />
        ) : null}

        <SosMap lat={fix?.lat ?? null} lng={fix?.lng ?? null} trail={trail} label="You are here" height={240} />

        <Card>
          <Muted>{secondsAgo == null ? "Waiting for first update" : `Last updated ${secondsAgo}s ago`}</Muted>
          <Text className="mt-1 text-base text-slate-900">
            {fix ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}${fix.accuracy ? ` ±${Math.round(fix.accuracy)}m` : ""}` : "—"}
          </Text>
        </Card>

        <View className="gap-3 pb-8">
          <Btn title="CALL GUARDIAN" variant="primary" onPress={onCall} />
          <Btn title="SHARE LOCATION" variant="outline" onPress={onShare} />
          {isActive ? (
            <Btn title="RESOLVE SOS" variant="danger" loading={resolving} onPress={onResolve} />
          ) : (
            <Btn title="BACK TO HOME" variant="ghost" onPress={() => router.replace("/home")} />
          )}
        </View>
      </View>
    </View>
  );
}



