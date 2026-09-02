import { Alert, Linking, Platform, Share } from "react-native";

export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function emergencyMessage(lat: number, lng: number) {
  return `🚨 EMERGENCY ALERT\n\nI need help.\n\nMy current location:\n${mapsUrl(lat, lng)}`;
}

const isWeb = Platform.OS === "web";

/** Opens a tel:/sms: URL. react-native-web's canOpenURL lies about these, so go direct on web. */
async function openUrl(url: string) {
  if (isWeb) {
    if (typeof window === "undefined") return false;
    window.location.href = url;
    return true;
  }
  const ok = await Linking.canOpenURL(url);
  if (!ok) return false;
  await Linking.openURL(url);
  return true;
}

/** Native share sheet (WhatsApp / SMS / anything) with a plain HTTPS Google Maps URL. */
export async function shareLocation(lat: number, lng: number) {
  const message = emergencyMessage(lat, lng);
  if (isWeb) {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav?.share) {
      await nav.share({ title: "🚨 EMERGENCY ALERT", text: message, url: mapsUrl(lat, lng) });
      return true;
    }
    if (nav?.clipboard) {
      await nav.clipboard.writeText(message);
      Alert.alert("Copied", "Emergency message copied — paste it into WhatsApp or SMS.");
      return true;
    }
    Alert.alert("Sharing unavailable", message);
    return false;
  }
  const result = await Share.share(
    Platform.OS === "ios" ? { message, url: mapsUrl(lat, lng) } : { message, title: "🚨 EMERGENCY ALERT" }
  );
  return result.action !== Share.dismissedAction;
}

export async function callNumber(phone: string) {
  const opened = await openUrl(`tel:${phone.replace(/[^+\d]/g, "")}`);
  if (!opened) Alert.alert("Cannot place call", "This device cannot open the dialer.");
  return opened;
}

export async function smsLocation(phone: string, lat: number, lng: number) {
  const sep = Platform.OS === "ios" ? "&" : "?";
  await openUrl(`sms:${phone.replace(/[^+\d]/g, "")}${sep}body=${encodeURIComponent(emergencyMessage(lat, lng))}`);
}

/** Multi-recipient sms: link — the only send path a browser has. */
export async function smsLinkToMany(phones: string[], message: string) {
  const to = phones.map((p) => p.replace(/[^+\d]/g, "")).join(",");
  const sep = Platform.OS === "ios" ? "&" : "?";
  return openUrl(`sms:${to}${sep}body=${encodeURIComponent(message)}`);
}
