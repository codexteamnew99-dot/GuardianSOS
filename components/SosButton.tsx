import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

const HOLD_MS = 5000;
const TICK_MS = 50;
const SIZE = 240;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

let haptics: typeof import("expo-haptics") | null = null;
try {
  haptics = require("expo-haptics");
} catch {
  haptics = null;
}

export function SosButton({
  onConfirm,
  activating = false,
  disabled = false,
}: {
  onConfirm: () => void;
  activating?: boolean;
  disabled?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const confirming = useRef(false);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setHolding(false);
    setProgress(0);
    setReady(false);
  }, []);

  useEffect(() => stop, [stop]);
  const askConfirm = useCallback(() => {
    confirming.current = true;
    Alert.alert(
      "Activate Emergency SOS?",
      "Your guardians will be notified and your current location will be shared.",
      [
        { text: "CANCEL", style: "cancel", onPress: () => { confirming.current = false; stop(); } },
        {
          text: "OK",
          style: "destructive",
          onPress: () => {
            confirming.current = false;
            stop();
            onConfirm();
          },
        },
      ],
      { cancelable: false }
    );
  }, [onConfirm, stop]);

  const onPressIn = () => {
    if (disabled || activating || confirming.current) return;
    haptics?.impactAsync(haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    startedAt.current = Date.now();
    setHolding(true);
    setReady(false);
    setProgress(0);
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - startedAt.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setReady(true);
        haptics?.notificationAsync(haptics.NotificationFeedbackType.Success).catch(() => {});
        askConfirm();
      }
    }, TICK_MS);
  };

  const onPressOut = () => {
    // release before 5s cancels: nothing is sent
    if (confirming.current) return;
    stop();
  };

  const secondsLeft = Math.max(1, Math.ceil((HOLD_MS - progress * HOLD_MS) / 1000));
  const label = activating ? "Activating…" : ready ? "SOS ready to activate" : holding ? "Keep holding" : "Hold for 5s";
  return (
    <View className="items-center gap-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Emergency SOS. Press and hold five seconds."
        disabled={disabled || activating}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        delayLongPress={HOLD_MS}
        className={disabled || activating ? "opacity-60" : ""}
      >
        <View style={{ width: SIZE, height: SIZE }} className="items-center justify-center">
          <Svg width={SIZE} height={SIZE} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="#FEE2E2" strokeWidth={STROKE} fill="none" />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke="#991B1B"
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${C}`}
              strokeDashoffset={C * (1 - progress)}
              strokeLinecap="round"
            />
          </Svg>
          <View
            style={{ width: SIZE - STROKE * 3, height: SIZE - STROKE * 3, borderRadius: SIZE }}
            className="items-center justify-center bg-red-600"
          >
            <Text className="text-6xl font-extrabold text-white">{holding && !ready ? secondsLeft : "SOS"}</Text>
            {holding && !ready ? <Text className="mt-1 text-base font-semibold text-red-100">holding…</Text> : null}
          </View>
        </View>
      </Pressable>

      <View className="h-14 w-full items-center justify-center">
        <Text className={`text-xl font-bold ${ready ? "text-red-700" : "text-slate-900"}`}>{label}</Text>
        <Text className="mt-1 text-center text-sm text-slate-500">
          {holding ? "Release to cancel" : "Press and hold the button to alert your guardians"}
        </Text>
      </View>

      {/* linear progress */}
      <View className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <View style={{ width: `${Math.round(progress * 100)}%` }} className="h-2 rounded-full bg-red-600" />
      </View>
    </View>
  );
}


