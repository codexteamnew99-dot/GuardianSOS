import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Expo Go (SDK 53+) removed remote push and THROWS if expo-notifications' native
// registration is imported. So we lazy-require it and skip entirely in Expo Go.
export const isExpoGo = Constants.executionEnvironment === "storeClient";

type NotificationsModule = typeof import("expo-notifications");
let _notif: NotificationsModule | null = null;
function notif(): NotificationsModule {
  if (!_notif) _notif = require("expo-notifications") as NotificationsModule;
  return _notif;
}

if (!isExpoGo) {
  notif().setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
}

export async function notificationPermissionStatus() {
  if (isExpoGo) return "unavailable in Expo Go";
  return (await notif().getPermissionsAsync()).status;
}

/** Registers this device's Expo push token. Throws a readable error; callers treat it as non-fatal. */
export async function registerPushToken(userId: string) {
  if (isExpoGo)
    throw new Error("Push needs a development build — Expo Go can't receive remote notifications. Guardians still get a live in-app alert.");
  const Notifications = notif();
  if (!Device.isDevice) throw new Error("Push notifications need a physical device.");
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("emergency", {
      name: "Emergency alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      sound: "default",
      lightColor: "#DC2626",
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") throw new Error("Notification permission denied.");

  const pid = projectId();
  if (!pid) throw new Error("Missing EAS projectId — run `npx eas init` to enable push.");

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data;
  const { error } = await supabase
    .from("device_tokens")
    .upsert({ user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: "token" });
  if (error) throw error;
  return token;
}
export type PushPayload = { title: string; body: string; data?: Record<string, unknown> };

/** Sends via Expo push service. Returns how many tickets were accepted. Never throws for per-token errors. */
export async function sendExpoPush(tokens: string[], payload: PushPayload) {
  const valid = tokens.filter((t) => t?.startsWith("ExponentPushToken") || t?.startsWith("ExpoPushToken"));
  if (valid.length === 0) return { sent: 0, failed: tokens.length, error: "No valid device tokens." };

  const messages = valid.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: "default",
    priority: "high",
    channelId: "emergency",
  }));

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  if (!res.ok) return { sent: 0, failed: valid.length, error: `Push service HTTP ${res.status}` };

  const json = (await res.json()) as { data?: { status: string; message?: string }[] };
  const tickets = json.data ?? [];
  const sent = tickets.filter((t) => t.status === "ok").length;
  const failedTicket = tickets.find((t) => t.status !== "ok");
  return {
    sent,
    failed: tickets.length - sent,
    error: sent === 0 ? failedTicket?.message ?? "Push rejected by Expo." : undefined,
  };
}

