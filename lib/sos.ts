import { getFix, type Fix } from "./location";
import { sendExpoPush } from "./push";
import { supabase } from "./supabase";
import type { Guardian, SosEvent } from "./types";

export type NotifyResult = { guardians: number; sent: number; failed: number; error?: string };

export async function getActiveSos(userId: string): Promise<SosEvent | null> {
  const { data, error } = await supabase
    .from("sos_events")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as SosEvent) ?? null;
}

export async function acceptedGuardians(ownerId: string): Promise<Guardian[]> {
  const { data, error } = await supabase
    .from("guardians")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("status", "ACCEPTED")
    .not("guardian_user_id", "is", null);
  if (error) throw error;
  return (data ?? []) as Guardian[];
}

/** Inserts notification rows + sends Expo push. Push failures are reported, not thrown. */
export async function notifyGuardians(event: SosEvent, senderName: string): Promise<NotifyResult> {
  const guardians = await acceptedGuardians(event.user_id);
  const ids = guardians.map((g) => g.guardian_user_id!).filter(Boolean);
  if (ids.length === 0) return { guardians: 0, sent: 0, failed: 0, error: "You have no accepted guardians yet." };

  const title = "🚨 EMERGENCY ALERT";
  const body = `${senderName} has activated GuardianSOS. Emergency location available. Tap to view.`;

  const { error: nErr } = await supabase
    .from("notifications")
    .insert(ids.map((uid) => ({ user_id: uid, sos_event_id: event.id, type: "SOS", title, body })));
  if (nErr) return { guardians: ids.length, sent: 0, failed: ids.length, error: nErr.message };

  const { data: tokens, error: tErr } = await supabase.from("device_tokens").select("token").in("user_id", ids);
  if (tErr) return { guardians: ids.length, sent: 0, failed: ids.length, error: tErr.message };

  const list = (tokens ?? []).map((t) => (t as { token: string }).token);
  const res = await sendExpoPush(list, { title, body, data: { sosEventId: event.id, type: "SOS" } });
  return { guardians: ids.length, sent: res.sent, failed: res.failed, error: res.error };
}
/**
 * GPS -> sos_events row -> first location row. Throws on any hard failure so the UI
 * never shows "SOS ACTIVE" for a write that did not land.
 */
export async function activateSos(userId: string): Promise<{ event: SosEvent; fix: Fix }> {
  const existing = await getActiveSos(userId);
  if (existing) {
    return { event: existing, fix: { lat: existing.lat ?? 0, lng: existing.lng ?? 0, accuracy: existing.accuracy } };
  }

  const fix = await getFix();

  const { data, error } = await supabase
    .from("sos_events")
    .insert({ user_id: userId, status: "ACTIVE", lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy })
    .select("*")
    .single();
  if (error) throw error;

  const event = data as SosEvent;
  await supabase
    .from("locations")
    .insert({ sos_event_id: event.id, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy });
  return { event, fix };
}

export async function pushLocation(sosEventId: string, fix: Fix) {
  const { error } = await supabase
    .from("locations")
    .insert({ sos_event_id: sosEventId, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy });
  if (error) throw error;
  await supabase
    .from("sos_events")
    .update({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy })
    .eq("id", sosEventId);
}

export async function resolveSos(sosEventId: string) {
  const { data, error } = await supabase
    .from("sos_events")
    .update({ status: "RESOLVED", resolved_at: new Date().toISOString() })
    .eq("id", sosEventId)
    .select("*")
    .single();
  if (error) throw error;
  return data as SosEvent;
}

export async function latestLocation(sosEventId: string) {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("sos_event_id", sosEventId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

