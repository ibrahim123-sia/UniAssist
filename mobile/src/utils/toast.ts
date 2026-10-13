import { Alert, Platform, ToastAndroid } from "react-native";

// Short non-blocking message: a native toast on Android, an alert on iOS
// (which has no toast).
export const toast = (message: string) => {
  if (Platform.OS === "android") ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(message);
};
