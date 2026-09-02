import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ShieldAlert } from "lucide-react-native";
import { Banner, Btn, Field, H1, Muted, Screen } from "../../components/Ui";
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

  // session lands asynchronously -> navigate reactively so we never strand the user here
  useEffect(() => {
    if (session && profile) router.replace(profile.full_name ? "/home" : "/profile-setup");
  }, [session, profile, router]);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) return setError("Email and password are required.");
    if (mode === "up" && !fullName.trim()) return setError("Your name is required.");
    if (mode === "up" && password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    try {
      if (mode === "in") {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password, fullName);
        if (needsConfirmation) {
          setMode("in");
          setInfo("Account created. Confirm your email, then sign in.");
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
        <View className="mt-12 items-center gap-2">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-red-600">
            <ShieldAlert size={34} color="#fff" />
          </View>
          <H1>GuardianSOS</H1>
          <Muted>Emergency alerts for the people who matter</Muted>
        </View>

        <View className="mt-10 gap-4">
          {error ? <Banner kind="error" text={error} /> : null}
          {info ? <Banner kind="success" text={info} /> : null}

          {mode === "up" ? (
            <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Alex Doe" autoCapitalize="words" />
          ) : null}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••" secureTextEntry />

          <Btn
            title={mode === "in" ? "Sign in" : "Create account"}
            variant="danger"
            loading={busy}
            onPress={submit}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode(mode === "in" ? "up" : "in");
              setError(null);
              setInfo(null);
            }}
            className="min-h-12 items-center justify-center"
          >
            <Text className="text-base font-semibold text-slate-700">
              {mode === "in" ? "No account? Create one" : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

