import React from "react";
import { Pressable, Text, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { useTheme } from "../hooks/useTheme";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  // Shown next to the spinner while loading (e.g. "Sending…"); without it
  // the spinner replaces the title.
  loadingTitle?: string;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<Props> = ({
  title, onPress, variant = "primary", loading, loadingTitle, disabled, style, textStyle, icon,
}) => {
  const { C } = useTheme();
  const bg =
    variant === "primary" ? C.navy :
    variant === "danger"  ? C.red :
    variant === "ghost"   ? "transparent" : C.surfaceAlt;
  const color =
    variant === "ghost" || variant === "secondary" ? C.text :
    variant === "primary" ? C.onNavy : "#fff";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => ({
        backgroundColor: bg,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        borderWidth: variant === "ghost" ? 1 : 0,
        borderColor: variant === "ghost" ? C.border : "transparent",
        ...style,
      })}
    >
      {loading ? (
        <>
          <ActivityIndicator color={color} />
          {loadingTitle ? (
            <Text style={{ color, fontWeight: "600", fontSize: 14, ...textStyle }}>{loadingTitle}</Text>
          ) : null}
        </>
      ) : (
        <>
          {icon}
          <Text style={{ color, fontWeight: "600", fontSize: 14, ...textStyle }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
};
