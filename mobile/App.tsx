import React, { useEffect } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Provider, useDispatch } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { store, persistor, type AppDispatch } from "./src/redux/store";
import RootNavigator from "./src/navigation/RootNavigator";
import { restoreSession, logout } from "./src/redux/slices/authSlice";
import { SERVER_URL, setSessionEndedHandler } from "./src/api/client";
import { useConnectivity } from "./src/hooks/useConnectivity";
import { useNotificationPolling } from "./src/hooks/useNotificationPolling";
import { useTheme } from "./src/hooks/useTheme";
import { palette } from "./src/theme/palette";

const Bootstrap: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isDark } = useTheme();
  useConnectivity();
  useNotificationPolling();

  useEffect(() => {
    // Expired/invalidated token or blocked account on any protected call:
    // sign out everywhere. Ignored until a session is actually live, so a
    // stale token rejected during restoreSession doesn't raise an alert.
    let ending = false;
    setSessionEndedHandler((message) => {
      if (ending || !store.getState().auth.token) return;
      ending = true;
      dispatch(logout()).finally(() => {
        ending = false;
        Alert.alert("Signed out", message);
      });
    });
    dispatch(restoreSession());
    return () => setSessionEndedHandler(null);
  }, [dispatch]);

  return (
    <>
      {/* Follows the in-app theme toggle, not the OS setting. */}
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </>
  );
};

const NotConfigured = () => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: palette.light.bg }}>
    <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8, color: palette.light.heading }}>Server not configured</Text>
    <Text style={{ textAlign: "center", color: palette.light.muted }}>
      Set EXPO_PUBLIC_SERVER_URL in mobile/.env and restart Expo with a cleared cache
      (npx expo start -c).
    </Text>
  </View>
);

export default function App() {
  if (!SERVER_URL) return <NotConfigured />;
  return (
    <Provider store={store}>
      <PersistGate
        loading={
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" />
          </View>
        }
        persistor={persistor}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <Bootstrap />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </PersistGate>
    </Provider>
  );
}
