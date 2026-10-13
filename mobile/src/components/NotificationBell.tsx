import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSelector } from "react-redux";
import { Bell } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../hooks/useTheme";
import type { RootState } from "../redux/store";

// The count is polled once app-wide by useNotificationPolling.
export const NotificationBell: React.FC = () => {
  const { C } = useTheme();
  const navigation = useNavigation<any>();
  const unread = useSelector((s: RootState) => s.notification.unreadCount);

  return (
    <Pressable onPress={() => navigation.navigate("Notifications")}
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
      <Bell color={C.text} size={20} />
      {unread > 0 && (
        <View style={{
          position: "absolute", right: 6, top: 2, minWidth: 16, height: 16,
          paddingHorizontal: 4, borderRadius: 8, backgroundColor: C.red,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
            {unread > 9 ? "9+" : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
};
