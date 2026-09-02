import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type PressableProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";

type ReactNode = React.ReactNode;

export function Screen({
  children,
  scroll = true,
  className = "",
}: {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
}) {
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          className={`flex-1 ${className}`}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full self-center" style={{ maxWidth: 680 }}>
            {children}
          </View>
        </ScrollView>
      ) : (
        <View className={`flex-1 px-5 ${className}`}>
          <View className="w-full flex-1 self-center" style={{ maxWidth: 680 }}>
            {children}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View className="mb-5 mt-4 flex-row items-center justify-between gap-3">
      <View className="flex-1 flex-row items-center gap-3">
        {onBack ? <IconButton label="Go back" onPress={onBack} icon={<ChevronLeft size={22} color="#0F172A" />} /> : null}
        <View className="flex-1">
          <Text className="text-3xl font-extrabold tracking-tight text-slate-950">{title}</Text>
          {subtitle ? <Text className="mt-1 text-base leading-6 text-slate-500">{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export function IconButton({
  label,
  onPress,
  icon,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.12)", borderless: true, radius: 22 }}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 22,
        backgroundColor: "#E2E8F0",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {icon}
    </Pressable>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text className="text-3xl font-extrabold tracking-tight text-slate-950">{children}</Text>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text className="text-xl font-bold text-slate-950">{children}</Text>;
}

export function Muted({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <Text className={`text-base leading-6 text-slate-500 ${className}`}>{children}</Text>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <View
      className={`rounded-3xl border border-slate-200 bg-white p-5 ${className}`}
      style={{ shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 }}
    >
      {children}
    </View>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View className="items-center justify-center gap-3 py-14">
      <ActivityIndicator size="large" color="#DC2626" />
      <Muted>{label}</Muted>
    </View>
  );
}

type BtnVariant = "primary" | "danger" | "outline" | "ghost";

const BUTTON_STYLES: Record<BtnVariant, { backgroundColor: string; borderColor: string; color: string }> = {
  primary: { backgroundColor: "#0F172A", borderColor: "#0F172A", color: "#FFFFFF" },
  danger: { backgroundColor: "#DC2626", borderColor: "#DC2626", color: "#FFFFFF" },
  outline: { backgroundColor: "#FFFFFF", borderColor: "#CBD5E1", color: "#0F172A" },
  ghost: { backgroundColor: "#F1F5F9", borderColor: "#F1F5F9", color: "#0F172A" },
};

export function Btn({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  accessibilityLabel,
  className = "",
}: {
  title: string;
  onPress?: PressableProps["onPress"];
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  className?: string;
}) {
  const off = disabled || loading;
  const palette = BUTTON_STYLES[variant];
  return (
    <View className={className}>
      <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.12)" }}
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        borderRadius: 18,
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: palette.backgroundColor,
        borderWidth: variant === "outline" ? 2 : 0,
        borderColor: palette.borderColor,
        opacity: off ? 0.52 : 1,
      }}
    >
      {loading ? <ActivityIndicator color={palette.color} /> : null}
        <Text style={{ color: palette.color }} className="text-center text-base font-bold">
          {title}
        </Text>
      </Pressable>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "words";
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-slate-700">{label}</Text>
      <TextInput
        className="min-h-14 rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-950"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

export function Banner({ kind, text }: { kind: "error" | "success" | "warn" | "info"; text: string }) {
  const colors = {
    error: { backgroundColor: "#FEF2F2", borderColor: "#FECACA", color: "#B91C1C", marker: "!" },
    success: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", color: "#15803D", marker: "✓" },
    warn: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", color: "#A16207", marker: "!" },
    info: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", color: "#1D4ED8", marker: "i" },
  }[kind];
  return (
    <View className="flex-row items-start gap-3 rounded-2xl border px-4 py-3" style={colors}>
      <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: colors.color }}>
        <Text className="text-sm font-extrabold text-white">{colors.marker}</Text>
      </View>
      <Text className="flex-1 text-sm font-semibold leading-5" style={{ color: colors.color }}>
        {text}
      </Text>
    </View>
  );
}
