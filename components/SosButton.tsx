import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Btn } from "./Ui";

const CONFIRM_SECONDS = 5;
const SIZE = 224;
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

type Props = {
  onConfirm: () => void;
  activating?: boolean;
  disabled?: boolean;
  onConfirmOpenChange?: (open: boolean) => void;
};

export const SosButton = forwardRef<SosButtonHandle, Props>(function SosButton(
  { onConfirm, activating = false, disabled = false, onConfirmOpenChange },
  ref,
) {
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

  const resolveConfirm = useCallback((send: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    clearCountdown();
    confirming.current = false;
    setOpen(false);
    if (send) onConfirmRef.current();
  }, [clearCountdown, setOpen]);

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

  return (
    <View className="items-center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Emergency SOS. Tap to open confirmation."
        accessibilityHint="A five-second countdown starts after confirmation."
        accessibilityState={{ disabled: disabled || activating }}
        disabled={disabled || activating}
        onPress={onPress}
        style={({ pressed }) => [
          { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
          pressed && { opacity: 0.86, transform: [{ scale: 0.97 }] },
          (disabled || activating) && { opacity: 0.58 },
        ]}
      >
        <Svg width={SIZE} height={SIZE} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="#FECACA" strokeWidth={STROKE} fill="none" />
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
          <Text className="text-6xl font-extrabold tracking-tight text-white">SOS</Text>
          <Text className="mt-1 text-xs font-bold uppercase tracking-widest text-red-100">Get help</Text>
        </View>
      </Pressable>
      <View className="mt-4 items-center">
        <Text className="text-lg font-extrabold text-slate-950">{activating ? "Activating alert…" : disabled ? "SOS already active" : "Tap to trigger SOS"}</Text>
        <Text className="mt-1 max-w-xs text-center text-sm leading-5 text-slate-500">
          {disabled ? "Open the active emergency screen to see updates." : "A confirmation step helps prevent accidental alerts."}
        </Text>
      </View>

      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => resolveConfirm(false)}
      >
        <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: "rgba(15,23,42,0.62)" }}>
          <View className="w-full max-w-sm rounded-3xl bg-white p-6" style={{ shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
            <View className="items-center">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <Text className="text-2xl font-extrabold text-red-700">!</Text>
              </View>
              <Text className="mt-4 text-center text-2xl font-extrabold text-slate-950">Send an SOS alert?</Text>
              <Text className="mt-2 text-center text-base leading-6 text-slate-600">
                We’ll share your current location with your emergency contacts and open the emergency screen.
              </Text>
            </View>
            <Text accessibilityLiveRegion="polite" className="mt-6 text-center text-6xl font-extrabold text-red-600">
              {countdown}
            </Text>
            <Text className="mt-1 text-center text-sm font-semibold text-slate-500">seconds until alert</Text>
            <View className="mt-6 gap-3">
              <Btn title="Send SOS now" variant="danger" onPress={() => resolveConfirm(true)} />
              <Btn title="Cancel" variant="outline" onPress={() => resolveConfirm(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});
