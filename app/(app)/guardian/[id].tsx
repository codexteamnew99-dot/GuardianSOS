import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Banner, Btn, Card, Loading, Muted } from "../../../components/Ui";
import { SosMap } from "../../../components/SosMap";
import { errMsg, supabase } from "../../../lib/supabase";
import { callNumber, mapsUrl, shareLocation } from "../../../lib/share";
import type { LocationRow, Profile, SosEvent } from "../../../lib/types";

export default function GuardianEmergency() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<SosEvent | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [points, setPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const [, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: e } = await supabase.from("sos_events").select("*").eq("id", id).maybeSingle();
        if (e) throw e;
        if (!data) throw new Error("You do not have access to this emergency alert.");
        if (cancelled) return;
        const ev = data as SosEvent;
        setEvent(ev);

        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, phone, email, photo_url")
          .eq("id", ev.user_id)
          .maybeSingle();
        if (!cancelled) setOwner((prof as Profile) ?? null);

        const { data: locs } = await supabase
          .from("locations")
          .select("*")
          .eq("sos_event_id", id)
          .order("recorded_at", { ascending: true })
          .limit(200);
        const rows = (locs ?? []) as LocationRow[];
        if (cancelled) return;
        setPoints(rows.map((r) => ({ lat: r.lat, lng: r.lng })));
        setLastAt(rows.length ? new Date(rows[rows.length - 1].recorded_at).getTime() : new Date(ev.started_at).getTime());
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);
  // realtime: new positions + status changes
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`sos-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "locations", filter: `sos_event_id=eq.${id}` },
        (payload) => {
          const row = payload.new as LocationRow;
          setPoints((p) => [...p.slice(-199), { lat: row.lat, lng: row.lng }]);
          setLastAt(new Date(row.recorded_at).getTime());
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sos_events", filter: `id=eq.${id}` },
        (payload) => setEvent(payload.new as SosEvent)
      )
      .subscribe((s) => setLive(s === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id]);

  const current = points.length ? points[points.length - 1] : event?.lat != null && event?.lng != null ? { lat: event.lat, lng: event.lng } : null;
  const secondsAgo = lastAt ? Math.max(0, Math.round((Date.now() - lastAt) / 1000)) : null;
  const name = owner?.full_name || "Your contact";

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Loading label="Loading emergency…" />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View className="flex-1 justify-center gap-4 bg-white px-5">
        <Banner kind="error" text={error ?? "Emergency not found."} />
        <Btn title="BACK TO HOME" variant="ghost" onPress={() => router.replace("/home")} />
      </View>
    );
  }
  const isActive = event.status === "ACTIVE";
  return (
    <View className="flex-1 bg-white">
      <View className={`px-5 pb-4 pt-14 ${isActive ? "bg-red-600" : "bg-slate-800"}`}>
        <Text className="text-2xl font-extrabold text-white">
          {isActive ? "🚨 EMERGENCY ALERT" : "EMERGENCY RESOLVED"}
        </Text>
        <Text className="mt-1 text-base text-red-50">
          {isActive ? `${name} needs help — live location below` : `${name} marked this as resolved`}
        </Text>
      </View>

      <View className="flex-1 gap-3 px-5 pt-4">
        <Banner kind={live ? "success" : "warn"} text={live ? "Live updates connected" : "Connecting to live updates…"} />

        <SosMap lat={current?.lat ?? null} lng={current?.lng ?? null} trail={points} label={`${name}'s location`} height={260} />

        <Card>
          <Muted>{secondsAgo == null ? "No position yet" : `Last updated ${secondsAgo}s ago`}</Muted>
          <Text className="mt-1 text-base text-slate-900">
            {current ? `${current.lat.toFixed(5)}, ${current.lng.toFixed(5)}` : "—"}
          </Text>
          <Text className="mt-1 text-sm text-slate-500">Started {new Date(event.started_at).toLocaleString()}</Text>
        </Card>

        <View className="gap-3 pb-8">
          <Btn
            title={`CALL ${name.split(" ")[0].toUpperCase()}`}
            variant="danger"
            onPress={() => (owner?.phone ? callNumber(owner.phone) : setError("No phone number on their profile."))}
          />
          <Btn
            title="OPEN IN GOOGLE MAPS"
            variant="primary"
            onPress={() => current && Linking.openURL(mapsUrl(current.lat, current.lng))}
          />
          <Btn
            title="SHARE LOCATION"
            variant="outline"
            onPress={() => current && shareLocation(current.lat, current.lng)}
          />
          <Btn title="BACK TO HOME" variant="ghost" onPress={() => router.replace("/home")} />
        </View>
      </View>
    </View>
  );
}


