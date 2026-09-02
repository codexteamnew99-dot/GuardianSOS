import { PermissionsAndroid, Platform, type Permission } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import * as SMS from "expo-sms";
import { supabase } from "./supabase";
import { callNumber, emergencyMessage, smsLinkToMany } from "./share";
import type { EmergencyContact } from "./types";

const autoAlerted = new Set<string>();
const isWeb = Platform.OS === "web";

type EmergencyCommsNative = {
  canSendDirectSms?: () => boolean;
  canImmediateCall?: () => boolean;
  getCallState?: () => string;
  sendSms: (phone: string, message: string) => Promise<void>;
  immediateCall: (phone: string) => Promise<void>;
};

export type ActionState = { status: "idle" | "loading" | "success" | "error"; message: string };

export type SmsPath = "android-direct" | "composer" | "sms-link";
export type CallPath = "android-immediate" | "tel";

export type SmsResult = {
  path: SmsPath | null;
  sent: number;
  failed: number;
  error?: string;
};

export type CallResult = {
  path: CallPath | null;
  name?: string;
  dialed: number;
  total: number;
  error?: string;
};

export type EmergencyAlertResult = {
  skipped?: boolean;
  contacts: EmergencyContact[];
  sms: SmsResult;
  call: CallResult;
};

function native(): EmergencyCommsNative | null {
  return requireOptionalNativeModule<EmergencyCommsNative>("EmergencyComms");
}

export function digits(phone: string) {
  return phone.replace(/[^+\d]/g, "");
}

export async function loadEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  const { data, error } = await supabase
    .from("emergency_contacts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EmergencyContact[];
}

/**
 * Android forces a one-time runtime grant for SMS/calling — it cannot be waived.
 * We ask ONCE at login so an actual SOS never stops to prompt.
 */
export type CommsPermissions = { sms: boolean; call: boolean; phoneState: boolean };

const ANDROID_COMMS = (): Permission[] => {
  // react-native-web has no PermissionsAndroid at all — never touch it off Android.
  if (Platform.OS !== "android") return [];
  const P = PermissionsAndroid.PERMISSIONS;
  return [P.SEND_SMS, P.CALL_PHONE, P.READ_PHONE_STATE];
};

export async function ensureEmergencyPermissions(): Promise<CommsPermissions> {
  const none = { sms: false, call: false, phoneState: false };
  if (Platform.OS !== "android") return none;
  if (!native()) return none; // Expo Go: no native module, nothing to grant
  const perms = ANDROID_COMMS();
  const [sms, call, phoneState] = await Promise.all(perms.map((p) => PermissionsAndroid.check(p)));
  if (sms && call && phoneState) return { sms, call, phoneState };
  const res = await PermissionsAndroid.requestMultiple(perms);
  const out = {
    sms: res[perms[0]] === PermissionsAndroid.RESULTS.GRANTED,
    call: res[perms[1]] === PermissionsAndroid.RESULTS.GRANTED,
    phoneState: res[perms[2]] === PermissionsAndroid.RESULTS.GRANTED,
  };
  console.log(`[SOS PERMS] pre-grant sms=${out.sms} call=${out.call} phoneState=${out.phoneState}`);
  return out;
}

export async function emergencyPermissionStatus(): Promise<string> {
  if (isWeb) return "browser — opens your messaging app / dialer";
  if (Platform.OS !== "android") return "iOS — needs one tap per send/call";
  if (!native()) return "needs a development build";
  const [sms, call] = await Promise.all(ANDROID_COMMS().slice(0, 2).map((p) => PermissionsAndroid.check(p)));
  if (sms && call) return "granted";
  if (!sms && !call) return "not granted";
  return sms ? "SMS only" : "calling only";
}

async function requestAndroidPermission(
  permission: Permission,
  title: string,
  message: string
): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (await PermissionsAndroid.check(permission)) return true;
  const granted = await PermissionsAndroid.request(permission, {
    title,
    message,
    buttonPositive: "Allow",
    buttonNegative: "Deny",
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function canDirectSms(): boolean {
  if (Platform.OS !== "android") return false;
  const mod = native();
  return !!mod && mod.canSendDirectSms?.() !== false && typeof mod.sendSms === "function";
}

function canImmediateCall(): boolean {
  if (Platform.OS !== "android") return false;
  const mod = native();
  return !!mod && mod.canImmediateCall?.() !== false && typeof mod.immediateCall === "function";
}

export async function sendEmergencySMS(
  contacts: Pick<EmergencyContact, "name" | "phone">[],
  message: string
): Promise<SmsResult> {
  const numbered = contacts
    .map((c) => ({ name: c.name, phone: digits(c.phone) }))
    .filter((c) => c.phone);
  if (numbered.length === 0) {
    return { path: null, sent: 0, failed: 0, error: "No valid phone numbers on emergency contacts." };
  }
  const numbers = numbered.map((c) => c.phone);

  // Browser: no native module and no expo-sms — an sms: link with every recipient is the only path.
  if (isWeb) {
    console.log(`[SOS SMS] path=sms-link (browser) contacts=${numbers.length}`);
    const opened = await smsLinkToMany(numbers, message);
    return opened
      ? { path: "sms-link", sent: numbers.length, failed: 0 }
      : {
          path: null,
          sent: 0,
          failed: numbers.length,
          error: "This browser cannot open a messaging app — use SHARE LOCATION to send the alert.",
        };
  }

  if (canDirectSms()) {
    const ok = await requestAndroidPermission(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      "Send emergency SMS",
      "GuardianSOS needs to text your emergency contacts without opening the composer."
    );
    if (ok) {
      console.log(`[SOS SMS] path=android-direct contacts=${numbers.length}`);
      const mod = native()!;
      let sent = 0;
      const errors: string[] = [];
      for (const c of numbered) {
        try {
          await mod.sendSms(c.phone, message);
          sent += 1;
        } catch (e) {
          errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const failed = numbered.length - sent;
      return {
        path: "android-direct",
        sent,
        failed,
        error: failed ? `Direct SMS: ${sent} sent, ${failed} failed. ${errors.join("; ")}` : undefined,
      };
    }
    console.log("[SOS SMS] android-direct unavailable (SEND_SMS denied) — falling back to composer");
  } else {
    console.log("[SOS SMS] android-direct unavailable (not Android, Expo Go, or native module missing)");
  }

  const available = await SMS.isAvailableAsync();
  if (!available) {
    return {
      path: null,
      sent: 0,
      failed: numbers.length,
      error: "SMS is not available on this device. Open a development build on Android for background send.",
    };
  }

  console.log(`[SOS SMS] path=composer (expo-sms) contacts=${numbers.length}`);
  const { result } = await SMS.sendSMSAsync(numbers, message);
  if (result === "cancelled") {
    return { path: "composer", sent: 0, failed: numbers.length, error: "SMS composer was cancelled." };
  }
  return { path: "composer", sent: numbers.length, failed: 0 };
}

export async function dialPrimaryContact(phone: string, name?: string): Promise<CallResult> {
  const number = digits(phone);
  if (!number) return { path: null, name, dialed: 0, total: 1, error: "Contact has no valid phone number." };

  if (canImmediateCall()) {
    const ok = await requestAndroidPermission(
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
      "Place emergency call",
      "GuardianSOS needs to call your emergency contacts immediately."
    );
    if (ok) {
      try {
        console.log("[SOS CALL] path=android-immediate");
        await native()!.immediateCall(number);
        return { path: "android-immediate", name, dialed: 1, total: 1 };
      } catch (e) {
        console.log("[SOS CALL] android-immediate failed — falling back to tel:", e);
      }
    } else {
      console.log("[SOS CALL] CALL_PHONE denied — falling back to tel:");
    }
  }

  console.log("[SOS CALL] path=tel");
  const opened = await callNumber(number);
  if (!opened) return { path: "tel", name, dialed: 0, total: 1, error: "Could not open the phone dialer." };
  return { path: "tel", name, dialed: 1, total: 1 };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits for the current call to start and finish so the next contact can be dialed. */
async function waitForCallToEnd(maxMs = 60_000) {
  const mod = native();
  if (!mod?.getCallState) {
    await sleep(20_000); // no telephony read access — space the calls out instead
    return;
  }
  const start = Date.now();
  let sawCall = false;
  while (Date.now() - start < maxMs) {
    await sleep(1000);
    const state = mod.getCallState();
    if (state === "unknown") {
      await sleep(20_000);
      return;
    }
    if (state === "offhook" || state === "ringing") sawCall = true;
    else if (state === "idle" && sawCall) return;
  }
}

/**
 * Dials every contact in turn — Android can only hold one call at a time, so the next
 * contact is dialed as soon as the previous call ends (unanswered calls end by themselves).
 */
export async function callAllContacts(
  contacts: Pick<EmergencyContact, "name" | "phone">[],
  onProgress?: (dialed: number, total: number, name: string) => void
): Promise<CallResult> {
  const list = contacts.map((c) => ({ name: c.name, phone: digits(c.phone) })).filter((c) => c.phone);
  if (list.length === 0) return { path: null, dialed: 0, total: 0, error: "No valid phone numbers on emergency contacts." };

  // Browser: dialing here would navigate away from the SMS link fired in parallel.
  if (isWeb) {
    return {
      path: null,
      name: list[0].name,
      dialed: 0,
      total: list.length,
      error: `A browser cannot place calls automatically — tap Call ${list[0].name} below.`,
    };
  }

  const auto = canImmediateCall()
    ? await requestAndroidPermission(
        PermissionsAndroid.PERMISSIONS.CALL_PHONE,
        "Place emergency call",
        "GuardianSOS needs to call your emergency contacts immediately."
      )
    : false;

  // Without auto-dial we can only hand the first number to the system dialer.
  if (!auto) {
    const first = await dialPrimaryContact(list[0].phone, list[0].name);
    return {
      ...first,
      total: list.length,
      error:
        first.error ??
        (list.length > 1
          ? `Auto-dial unavailable here — ${list.length - 1} more contact${list.length === 2 ? "" : "s"} must be called with the buttons below.`
          : undefined),
    };
  }

  console.log(`[SOS CALL] path=android-immediate queue=${list.length}`);
  let dialed = 0;
  const errors: string[] = [];
  for (const c of list) {
    try {
      onProgress?.(dialed, list.length, c.name);
      await native()!.immediateCall(c.phone);
      dialed += 1;
      if (dialed < list.length) await waitForCallToEnd();
    } catch (e) {
      errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return {
    path: "android-immediate",
    name: list[0].name,
    dialed,
    total: list.length,
    error: errors.length ? `Some calls failed — ${errors.join("; ")}` : undefined,
  };
}

export async function alertEmergencyContacts(
  userId: string,
  eventId: string,
  lat: number,
  lng: number,
  opts?: { force?: boolean; onCallProgress?: (dialed: number, total: number, name: string) => void }
): Promise<EmergencyAlertResult> {
  if (!opts?.force && autoAlerted.has(eventId)) {
    return {
      skipped: true,
      contacts: [],
      sms: { path: null, sent: 0, failed: 0 },
      call: { path: null, dialed: 0, total: 0 },
    };
  }
  autoAlerted.add(eventId);

  const contacts = await loadEmergencyContacts(userId);
  if (contacts.length === 0) {
    return {
      contacts,
      sms: { path: null, sent: 0, failed: 0, error: "No emergency contacts saved." },
      call: { path: null, dialed: 0, total: 0, error: "No emergency contact to call." },
    };
  }

  const message = emergencyMessage(lat, lng);
  const [smsSettled, callSettled] = await Promise.allSettled([
    sendEmergencySMS(contacts, message),
    callAllContacts(contacts, opts?.onCallProgress),
  ]);

  const sms: SmsResult =
    smsSettled.status === "fulfilled"
      ? smsSettled.value
      : { path: null, sent: 0, failed: contacts.length, error: String(smsSettled.reason) };
  const call: CallResult =
    callSettled.status === "fulfilled"
      ? callSettled.value
      : { path: null, name: contacts[0].name, dialed: 0, total: contacts.length, error: String(callSettled.reason) };

  return { contacts, sms, call };
}

export function smsBanner(sms: SmsResult | null, loading: boolean): ActionState {
  if (loading) return { status: "loading", message: "Sending emergency SMS…" };
  if (!sms) return { status: "idle", message: "" };
  if (sms.error && sms.sent === 0) return { status: "error", message: sms.error };
  if (sms.error) return { status: "error", message: sms.error };
  if (sms.path === "android-direct") {
    return { status: "success", message: `Emergency SMS sent to ${sms.sent} contact${sms.sent === 1 ? "" : "s"} (direct).` };
  }
  if (sms.path === "composer") {
    return { status: "success", message: `SMS composer opened for ${sms.sent} contact${sms.sent === 1 ? "" : "s"} — tap Send.` };
  }
  if (sms.path === "sms-link") {
    return { status: "success", message: `Messaging app opened for ${sms.sent} contact${sms.sent === 1 ? "" : "s"} — tap Send.` };
  }
  return { status: "idle", message: "" };
}

export function callBanner(call: CallResult | null, loading: boolean, progress?: string | null): ActionState {
  if (loading) return { status: "loading", message: progress || "Calling emergency contacts…" };
  if (!call) return { status: "idle", message: "" };
  if (call.error) return { status: "error", message: call.error };
  const who = call.name ? ` ${call.name}` : " primary contact";
  if (call.path === "android-immediate") {
    return {
      status: "success",
      message:
        call.total > 1
          ? `Auto-called ${call.dialed} of ${call.total} contacts.`
          : `Calling${who} (auto-dial).`,
    };
  }
  if (call.path === "tel") {
    return { status: "success", message: `Dialer opened for${who}.` };
  }
  return { status: "idle", message: "" };
}
