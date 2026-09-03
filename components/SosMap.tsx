import { Component, useEffect, useRef, type ReactNode } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import Constants from "expo-constants";
import type MapViewType from "react-native-maps";
import { mapsUrl } from "../lib/share";

// Expo Go (SDK 53+, Android) ships without Google Maps -> require lazily and fall back
let Maps: typeof import("react-native-maps") | null = null;
try {
  Maps = require("react-native-maps");
} catch {
  Maps = null;
}

// react-native-maps hard-crashes (native, uncatchable by JS error boundaries) at mount on
// Android when no Google Maps API key is in the manifest. Only mount it when a key exists.
const androidMapsKey = (Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey;
const nativeMapAvailable = Platform.OS === "ios" || (Platform.OS === "android" && !!androidMapsKey);

class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Fallback({ lat, lng, height }: { lat: number; lng: number; height: number }) {
  return (
    <View style={{ height }} className="items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4">
      <Text className="text-lg font-semibold text-slate-900">{`${lat.toFixed(5)}, ${lng.toFixed(5)}`}</Text>
      <Text className="text-center text-sm text-slate-500">
        Live location is active and updating. Tap to open it in Google Maps.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openURL(mapsUrl(lat, lng))}
        className="min-h-12 justify-center rounded-xl bg-slate-900 px-4"
      >
        <Text className="text-base font-semibold text-white">Open in Google Maps</Text>
      </Pressable>
    </View>
  );
}
function NativeMap({
  lat,
  lng,
  trail,
  label,
  height,
}: {
  lat: number;
  lng: number;
  trail: { lat: number; lng: number }[];
  label: string;
  height: number;
}) {
  const ref = useRef<MapViewType | null>(null);
  const MapView = Maps!.default;
  const { Marker, Polyline } = Maps!;

  useEffect(() => {
    ref.current?.animateCamera({ center: { latitude: lat, longitude: lng }, zoom: 16 }, { duration: 600 });
  }, [lat, lng]);

  return (
    <View style={{ height }} className="overflow-hidden rounded-2xl border border-slate-200">
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} title={label} pinColor="red" />
        {trail.length > 1 ? (
          <Polyline
            coordinates={trail.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor="#DC2626"
            strokeWidth={4}
          />
        ) : null}
      </MapView>
    </View>
  );
}

export function SosMap({
  lat,
  lng,
  trail = [],
  label = "Emergency location",
  height = 280,
}: {
  lat: number | null;
  lng: number | null;
  trail?: { lat: number; lng: number }[];
  label?: string;
  height?: number;
}) {
  if (lat == null || lng == null) {
    return (
      <View style={{ height }} className="items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
        <Text className="text-base text-slate-500">Waiting for a GPS fix…</Text>
      </View>
    );
  }
  if (!Maps || Platform.OS === "web" || !nativeMapAvailable) return <Fallback lat={lat} lng={lng} height={height} />;
  return (
    <MapBoundary fallback={<Fallback lat={lat} lng={lng} height={height} />}>
      <NativeMap lat={lat} lng={lng} trail={trail} label={label} height={height} />
    </MapBoundary>
  );
}

