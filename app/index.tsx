import { Redirect } from "expo-router";
import { View } from "react-native";
import { Loading } from "../components/Ui";
import { useAuth } from "../lib/auth";

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Loading label="Starting GuardianSOS…" />
      </View>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile?.full_name) return <Redirect href="/profile-setup" />;
  return <Redirect href="/home" />;
}
