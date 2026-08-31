import { Alert, Linking, Platform, Share } from "react-native";

export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function emergencyMessage(lat: number, lng: number) {
  return `🚨 EMERGENCY ALERT\n\nI need help.\n\nMy current location:\n${mapsUrl(lat, lng)}`;
}

/** Native share sheet (WhatsApp / SMS / anything) with a plain HTTPS Google Maps URL. */
export async function shareLocation(lat: number, lng: number) {
  const message = emergencyMessage(lat, lng);
  const result = await Share.share(
    Platform.OS === "ios" ? { message, url: mapsUrl(lat, lng) } : { message, title: "🚨 EMERGENCY ALERT" }
  );
  return result.action !== Share.dismissedAction;
}

export async function callNumber(phone: string) {
  const url = `tel:${phone.replace(/[^+\d]/g, "")}`;
  const ok = await Linking.canOpenURL(url);
  if (!ok) {
    Alert.alert("Cannot place call", "This device cannot open the dialer.");
    return false;
  }
  await Linking.openURL(url);
  return true;
}

export async function smsLocation(phone: string, lat: number, lng: number) {
  const sep = Platform.OS === "ios" ? "&" : "?";
  const url = `sms:${phone.replace(/[^+\d]/g, "")}${sep}body=${encodeURIComponent(emergencyMessage(lat, lng))}`;
  await Linking.openURL(url);
}
