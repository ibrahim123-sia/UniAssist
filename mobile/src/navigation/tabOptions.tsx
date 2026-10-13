import React from "react";
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { NotificationBell } from "../components/NotificationBell";
import type { Palette } from "../theme/palette";

export const tabScreenOptions = (C: Palette): BottomTabNavigationOptions => ({
  tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.border },
  tabBarActiveTintColor: C.navy,
  tabBarInactiveTintColor: C.muted,
  headerStyle: { backgroundColor: C.surface },
  headerTitleStyle: { color: C.text },
  headerRight: () => <NotificationBell />,
  tabBarLabelStyle: { fontSize: 10 },
});
