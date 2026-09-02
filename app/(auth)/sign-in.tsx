import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight, ShieldAlert, Sparkles } from "lucide-react-native";
import { Banner, Btn, Card, Field, Muted, Screen } from "../../components/Ui";
import { useAuth } from "../../lib/auth";
import { errMsg } from "../../lib/supabase";

export default function SignIn() {
  const { signIn, signUp, session, profile } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (session && profile) router.replace(profile.full_name ? "/home" : "/profile-setup");
  }, [session, profile, router]);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) return setError("Enter your email and password to continue.");
    if (mode === "up" && !fullName.trim()) return setError("Add your name so your contacts know who needs help.");
    if (mode === "up" && password.length < 6) return setError("Choose a password with at least 6 characters.");
    setBusy(true);
    try {
      if (mode === "in") {
        await signIn(email.trim(), password);
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password, fullName.trim());
        if (needsConfirmation) {
          setMode("in");
          setInfo("Account created. Check your email to confirm, then sign in.");
        }
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="mb-7 mt-10 items-center">
          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-red-600" style={{ shadowColor: "#DC2626", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 4 }}>
            <ShieldAlert size={34} color="#FFFFFF" />
          </View>
          <Text className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950">GuardianSOS</Text>
          <Text className="mt-2 text-center text-base leading-6 text-slate-500">A calm, simple way to alert the people who matter.</Text>
        </View>

        <Card className="gap-5">
          <View className="flex-row items-center gap-2 rounded-2xl bg-slate-100 p-1">
            {(["in", "up"] as const).map((item) => {
              const selected = mode === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setMode(item);
                    setError(null);
                    setInfo(null);
                  }}
                  style={{ flex: 1, alignItems: "center", borderRadius: 14, paddingVertical: 11, backgroundColor: selected ? "#FFFFFF" : "transparent" }}
                >
                  <Text className={`text-sm font-extrabold ${selected ? "text-slate-950" : "text-slate-500"}`}>{item === "in" ? "Sign in" : "Create account"}</Text>
                </Pressable>
              );
            })}
          </View>

          <View>
            <Text className="text-2xl font-extrabold text-slate-950">{mode === "in" ? "Welcome back" : "Set up your safety account"}</Text>
            <Muted className="mt-1">{mode === "in" ? "Sign in to keep your emergency contacts ready." : "It only takes a minute to get started."}</Muted>
          </View>

          {error ? <Banner kind="error" text={error} /> : null}
          {info ? <Banner kind="success" text={info} /> : null}
          {mode === "up" ? <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="e.g. Alex Doe" autoCapitalize="words" /> : null}
          <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />
          <Btn title={mode === "in" ? "Sign in" : "Create account"} variant="danger" loading={busy} onPress={submit} />
        </Card>

        <View className="mt-5 flex-row items-center justify-center gap-2">
          <Sparkles size={15} color="#DC2626" />
          <Text className="text-sm font-semibold text-slate-600">Your location is shared only when you activate SOS.</Text>
        </View>
        <View className="mt-4 flex-row items-center justify-center gap-1">
          <Text className="text-sm text-slate-500">{mode === "in" ? "New to GuardianSOS?" : "Already have an account?"}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode(mode === "in" ? "up" : "in");
              setError(null);
              setInfo(null);
            }}
          >
            <View className="flex-row items-center gap-1">
              <Text className="text-sm font-extrabold text-red-700">{mode === "in" ? "Create one" : "Sign in"}</Text>
              <ArrowRight size={15} color="#B91C1C" />
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
