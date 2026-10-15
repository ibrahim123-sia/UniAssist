import React from "react";
import { Pressable, Text } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { radius } from "../theme/palette";

export const FilterChip: React.FC<{
  label: string; active?: boolean; onPress?: () => void;
}> = ({ label, active, onPress }) => {
  const { C, isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => ({
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: radius.pill, marginRight: 6, marginBottom: 6,
        // Pills: white in Day Desk, transparent in Night Desk; active = primary.
        backgroundColor: active ? C.primary : pressed ? C.navHover : isDark ? "transparent" : C.surface,
        borderColor: active ? C.primary : C.borderStrong, borderWidth: 1,
      })}
    >
      <Text style={{ color: active ? C.onPrimary : C.pill, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
};
