import * as Location from "expo-location";

export type Fix = { lat: number; lng: number; accuracy: number | null };

export async function permissionStatus() {
  const p = await Location.getForegroundPermissionsAsync();
  return p.status;
}

export async function ensureLocationPermission() {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === "granted") return;
  const asked = await Location.requestForegroundPermissionsAsync();
  if (asked.status !== "granted") {
    throw new Error("Location permission denied. Enable it in Settings to send an SOS.");
  }
}

/** GPS fix with real validation + timeout; throws user-readable errors */
export async function getFix(timeoutMs = 20000): Promise<Fix> {
  await ensureLocationPermission();
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) throw new Error("Location services are off. Turn on GPS and try again.");

  const pos = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<never>((_r, reject) =>
      setTimeout(() => reject(new Error("GPS timed out. Move to an open area and retry.")), timeoutMs)
    ),
  ]);

  const { latitude, longitude, accuracy } = pos.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
    throw new Error("GPS returned an invalid position. Retry in a moment.");
  }
  return { lat: latitude, lng: longitude, accuracy: accuracy ?? null };
}

export async function watchFix(onFix: (f: Fix) => void, onError?: (e: unknown) => void) {
  await ensureLocationPermission();
  try {
    return await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 20 },
      (pos) => onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null })
    );
  } catch (e) {
    onError?.(e);
    return null;
  }
}
