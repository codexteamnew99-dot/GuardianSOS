import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({
  children,
  scroll = true,
  className = "",
}: {
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
}) {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView className={`flex-1 px-5 ${className}`} contentContainerStyle={{ paddingBottom: 32 }}>
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 px-5 ${className}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text className="text-3xl font-bold text-slate-900">{children}</Text>;
}

export function Muted({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-base text-slate-500 ${className}`}>{children}</Text>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <View className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>{children}</View>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View className="items-center justify-center gap-3 py-10">
      <ActivityIndicator size="large" color="#DC2626" />
      {label ? <Muted>{label}</Muted> : null}
    </View>
  );
}
type BtnVariant = "primary" | "danger" | "outline" | "ghost";

const BTN: Record<BtnVariant, string> = {
  primary: "bg-slate-900",
  danger: "bg-red-600",
  outline: "bg-white border-2 border-slate-300",
  ghost: "bg-slate-100",
};
const BTN_TEXT: Record<BtnVariant, string> = {
  primary: "text-white",
  danger: "text-white",
  outline: "text-slate-900",
  ghost: "text-slate-900",
};

export function Btn({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      className={`min-h-14 flex-row items-center justify-center gap-2 rounded-2xl px-5 py-4 ${BTN[variant]} ${
        off ? "opacity-50" : ""
      } ${className}`}
    >
      {loading ? <ActivityIndicator color={variant === "outline" || variant === "ghost" ? "#0F172A" : "#fff"} /> : null}
      <Text className={`text-center text-lg font-semibold ${BTN_TEXT[variant]}`}>{title}</Text>
    </Pressable>
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
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-slate-700">{label}</Text>
      <TextInput
        className="min-h-14 rounded-xl border border-slate-300 bg-white px-4 text-lg text-slate-900"
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
  const style =
    kind === "error"
      ? "bg-red-50 border-red-300"
      : kind === "success"
        ? "bg-green-50 border-green-300"
        : kind === "warn"
          ? "bg-amber-50 border-amber-300"
          : "bg-slate-50 border-slate-300";
  const textStyle =
    kind === "error"
      ? "text-red-700"
      : kind === "success"
        ? "text-green-700"
        : kind === "warn"
          ? "text-amber-800"
          : "text-slate-700";
  return (
    <View className={`rounded-xl border px-4 py-3 ${style}`}>
      <Text className={`text-base font-medium ${textStyle}`}>{text}</Text>
    </View>
  );
}


