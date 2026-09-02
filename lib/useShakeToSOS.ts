import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { Accelerometer } from "expo-sensors";
import { getShakeToSosEnabled } from "./settings";

const SHAKE_G = 1.8;
const REFRACTORY_MS = 400;
const WINDOW_MS = 1500;
const COOLDOWN_MS = 3000;
const INTERVAL_MS = 100;

export function useShakeToSOS({
  sosActive,
  confirmOpen,
  onTrigger,
}: {
  sosActive: boolean;
  confirmOpen: boolean;
  onTrigger: () => void;
}) {
  const sosActiveRef = useRef(sosActive);
  sosActiveRef.current = sosActive;
  const confirmOpenRef = useRef(confirmOpen);
  confirmOpenRef.current = confirmOpen;
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  const lastSpikeAt = useRef(0);
  const spikes = useRef<number[]>([]);
  const cooldownUntil = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let sub: { remove: () => void } | null = null;
      let cancelled = false;

      (async () => {
        const enabled = await getShakeToSosEnabled();
        if (cancelled || !enabled) return;
        try {
          if (!(await Accelerometer.isAvailableAsync())) return;
          if (cancelled) return;
          Accelerometer.setUpdateInterval(INTERVAL_MS);
          sub = Accelerometer.addListener(({ x, y, z }) => {
            if (sosActiveRef.current || confirmOpenRef.current) return;
            const now = Date.now();
            if (now < cooldownUntil.current) return;
            const mag = Math.sqrt(x * x + y * y + z * z);
            if (mag < SHAKE_G) return;
            if (now - lastSpikeAt.current < REFRACTORY_MS) return;
            lastSpikeAt.current = now;
            spikes.current = spikes.current.filter((t) => now - t <= WINDOW_MS);
            spikes.current.push(now);
            if (spikes.current.length >= 2) {
              spikes.current = [];
              cooldownUntil.current = now + COOLDOWN_MS;
              onTriggerRef.current();
            }
          });
        } catch {
          return; // no usable accelerometer (desktop browser) — shake detection stays off
        }
        if (cancelled) {
          sub.remove();
          sub = null;
        }
      })();

      return () => {
        cancelled = true;
        sub?.remove();
        sub = null;
      };
    }, [])
  );
}
