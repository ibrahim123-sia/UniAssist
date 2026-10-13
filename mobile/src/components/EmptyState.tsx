import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../hooks/useTheme";

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; description?: string }> = ({
  icon, title, description,
}) => {
  const { C } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: 28 }}>
      {icon}
      <Text style={{ fontWeight: "700", fontSize: 16, color: C.text, marginTop: 8 }}>{title}</Text>
      {description && (
        <Text style={{ color: C.muted, fontSize: 13, marginTop: 4, textAlign: "center" }}>
          {description}
        </Text>
      )}
    </View>
  );
};
