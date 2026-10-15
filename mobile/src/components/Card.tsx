import React from "react";
import { View, ViewStyle } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { cardShadow, radius } from "../theme/palette";

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children, style,
}) => {
  const { C, isDark } = useTheme();
  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderColor: C.border,
        borderWidth: 1,
        borderRadius: radius.card,
        padding: 16,
        ...cardShadow(isDark),
        ...style,
      }}
    >
      {children}
    </View>
  );
};
