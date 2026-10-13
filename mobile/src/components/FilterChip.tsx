import React from "react";
import { Pressable, Text } from "react-native";
import { useTheme } from "../hooks/useTheme";

export const FilterChip: React.FC<{
  label: string; active?: boolean; onPress?: () => void;
}> = ({ label, active, onPress }) => {
  const { C } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => ({
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 999, marginRight: 6, marginBottom: 6,
        backgroundColor: active ? C.navy : C.surfaceAlt,
        borderColor: active ? C.navy : C.border, borderWidth: 1,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: active ? C.onNavy : C.text, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
};
