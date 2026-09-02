import AsyncStorage from "@react-native-async-storage/async-storage";

const SHAKE_TO_SOS_KEY = "settings.shakeToSos";

/** Default ON when the user has never set a preference. */
export async function getShakeToSosEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(SHAKE_TO_SOS_KEY);
  return v !== "0";
}

export async function setShakeToSosEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(SHAKE_TO_SOS_KEY, on ? "1" : "0");
}
