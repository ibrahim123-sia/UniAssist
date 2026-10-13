import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSelector } from "react-redux";
import type { RootState } from "../redux/store";
import { useTheme } from "../hooks/useTheme";

import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import OtpVerifyScreen from "../screens/auth/OtpVerifyScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";

import StudentTabs from "./StudentTabs";
import IssueDetailScreen from "../screens/student/IssueDetailScreen";
import NewIssueScreen from "../screens/student/NewIssueScreen";
import ChatScreen from "../screens/student/ChatScreen";
import ListingDetailScreen from "../screens/student/ListingDetailScreen";
import MyQuestionsScreen from "../screens/student/MyQuestionsScreen";
import NotificationsScreen from "../screens/common/NotificationsScreen";

const Stack = createNativeStackNavigator();

// Students only: the auth slice never starts a session for any other account.
export default function RootNavigator() {
  const { C, isDark } = useTheme();
  const bootstrapped = useSelector((s: RootState) => s.auth.bootstrapped);
  const signedIn = useSelector((s: RootState) => !!s.auth.token && !!s.auth.user);

  if (!bootstrapped) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.navy} />
      </View>
    );
  }

  const navTheme = isDark ? DarkTheme : DefaultTheme;
  const stackHeader = {
    headerShown: true,
    headerStyle: { backgroundColor: C.surface },
    headerTitleStyle: { color: C.text },
    headerTintColor: C.navy,
  };

  return (
    <NavigationContainer
      theme={{ ...navTheme, colors: { ...navTheme.colors, background: C.bg, card: C.surface, border: C.border, primary: C.navy } }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!signedIn ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="StudentTabs" component={StudentTabs} />
            <Stack.Screen name="IssueDetail" component={IssueDetailScreen}
              options={{ ...stackHeader, title: "Issue" }} />
            <Stack.Screen name="NewIssue" component={NewIssueScreen}
              options={{ ...stackHeader, title: "Submit issue", presentation: "modal" }} />
            <Stack.Screen name="Chat" component={ChatScreen}
              options={{ ...stackHeader, title: "Chat" }} />
            <Stack.Screen name="ListingDetail" component={ListingDetailScreen}
              options={{ ...stackHeader, title: "Details" }} />
            <Stack.Screen name="MyQuestions" component={MyQuestionsScreen}
              options={{ ...stackHeader, title: "My questions" }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen}
              options={{ ...stackHeader, title: "Notifications" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
