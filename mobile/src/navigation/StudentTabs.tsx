import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  MessageSquare, AlertCircle, Briefcase, Award, Calendar, User,
} from "lucide-react-native";

import ChatListScreen from "../screens/student/ChatListScreen";
import IssuesScreen from "../screens/student/IssuesScreen";
import JobsScreen from "../screens/student/JobsScreen";
import ScholarshipsScreen from "../screens/student/ScholarshipsScreen";
import EventsScreen from "../screens/student/EventsScreen";
import ProfileScreen from "../screens/common/ProfileScreen";
import { useTheme } from "../hooks/useTheme";
import { tabScreenOptions } from "./tabOptions";

const Tab = createBottomTabNavigator();

export default function StudentTabs() {
  const { C } = useTheme();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(C)}>
      <Tab.Screen name="Chats" component={ChatListScreen}
        options={{ tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} /> }} />
      <Tab.Screen name="Issues" component={IssuesScreen}
        options={{ tabBarIcon: ({ color, size }) => <AlertCircle color={color} size={size} /> }} />
      <Tab.Screen name="Jobs" component={JobsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} /> }} />
      <Tab.Screen name="Scholarships" component={ScholarshipsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Award color={color} size={size} /> }} />
      <Tab.Screen name="Events" component={EventsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}
