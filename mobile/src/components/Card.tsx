import React from "react";
import { View, ViewStyle } from "react-native";
import { useTheme } from "../hooks/useTheme";

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children, style,
}) => {
  const { C } = useTheme();
  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderColor: C.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </View>
  );
};
