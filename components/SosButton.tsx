import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Btn } from "./Ui";

const CONFIRM_SECONDS = 5;
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

export type SosButtonHandle = { openConfirm: () => void };

export const SosButton = forwardRef<
  SosButtonHandle,
  {
    onConfirm: () => void;
    activating?: boolean;
    disabled?: boolean;
    onConfirmOpenChange?: (open: boolean) => void;
  }
>(function SosButton({ onConfirm, activating = false, disabled = false, onConfirmOpenChange }, ref) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [countdown, setCountdown] = useState(CONFIRM_SECONDS);

  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirming = useRef(false);
  const resolvedRef = useRef(false);
  const remainingRef = useRef(CONFIRM_SECONDS);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const onConfirmOpenChangeRef = useRef(onConfirmOpenChange);
  onConfirmOpenChangeRef.current = onConfirmOpenChange;

  const setOpen = useCallback((open: boolean) => {
    setConfirmOpen(open);
    onConfirmOpenChangeRef.current?.(open);
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    countdownTimer.current = null;
  }, []);

  const resolveConfirm = useCallback(
    (send: boolean) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      clearCountdown();
      confirming.current = false;
      setOpen(false);
      if (send) onConfirmRef.current();
    },
    [clearCountdown, setOpen]
  );

  useEffect(() => () => clearCountdown(), [clearCountdown]);

  const askConfirm = useCallback(() => {
    if (disabled || activating || confirming.current) return;
    confirming.current = true;
    resolvedRef.current = false;
    remainingRef.current = CONFIRM_SECONDS;
    clearCountdown();
    setCountdown(CONFIRM_SECONDS);
    setOpen(true);
    haptics?.notificationAsync(haptics.NotificationFeedbackType.Success).catch(() => {});
    countdownTimer.current = setInterval(() => {
      remainingRef.current -= 1;
      if (remainingRef.current <= 0) {
        resolveConfirm(true);
        return;
      }
      setCountdown(remainingRef.current);
    }, 1000);
  }, [activating, clearCountdown, disabled, resolveConfirm, setOpen]);

  useImperativeHandle(ref, () => ({ openConfirm: askConfirm }), [askConfirm]);

  const onPress = () => {
    if (disabled || activating || confirming.current) return;
    haptics?.impactAsync(haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    askConfirm();
  };

  const label = activating ? "Activating…" : "Tap to Trigger SOS";
  return (
    <View className="items-center gap-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Emergency SOS. Tap to confirm."
        disabled={disabled || activating}
        onPress={onPress}
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
              strokeDashoffset={0}
              strokeLinecap="round"
            />
          </Svg>
          <View
            style={{ width: SIZE - STROKE * 3, height: SIZE - STROKE * 3, borderRadius: SIZE }}
            className="items-center justify-center bg-red-600"
          >
            <Text className="text-6xl font-extrabold text-white">SOS</Text>
          </View>
        </View>
      </Pressable>

      <View className="h-14 w-full items-center justify-center">
        <Text className="text-xl font-bold text-slate-900">{label}</Text>
        <Text className="mt-1 text-center text-sm text-slate-500">Tap the button to alert your emergency contacts</Text>
      </View>

      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => resolveConfirm(false)}
      >
        <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="w-full max-w-sm rounded-2xl bg-white p-6">
            <Text className="text-center text-2xl font-extrabold text-red-700">SOS Alert</Text>
            <Text className="mt-3 text-center text-base text-slate-700">
              Are you sure you want to send an SOS alert?
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              className="mt-6 text-center text-6xl font-extrabold text-red-600"
            >
              {countdown}
            </Text>
            <Text className="mt-1 text-center text-sm font-medium text-slate-500">seconds remaining</Text>
            <View className="mt-6 flex-row gap-3">
              <View className="flex-1">
                <Btn title="Cancel" variant="outline" onPress={() => resolveConfirm(false)} />
              </View>
              <View className="flex-1">
                <Btn title="OK" variant="danger" onPress={() => resolveConfirm(true)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});
