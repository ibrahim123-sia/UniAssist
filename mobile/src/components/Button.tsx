import React from "react";
import { Pressable, Text, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { radius } from "../theme/palette";

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
  const off = !!(disabled || loading);
  // primary: solid blue. secondary / ghost: outlined neutral. danger: the
  // soft danger tone (readable in both modes).
  const look = {
    primary: { bg: C.primary, pressed: C.primaryHover, border: C.primary, color: C.onPrimary },
    secondary: { bg: C.surface, pressed: C.navHover, border: C.borderStrong, color: C.label },
    ghost: { bg: "transparent", pressed: C.navHover, border: C.borderStrong, color: C.label },
    danger: { bg: C.dangerBg, pressed: C.dangerBg, border: C.dangerBorder, color: C.danger },
  }[variant];
  // A disabled button greys out; a loading one keeps its colors.
  const greyed = !!disabled && !loading;
  const color = greyed ? C.disabledText : look.color;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: off, busy: !!loading }}
      style={({ pressed }) => ({
        backgroundColor: greyed ? C.disabledBg : pressed ? look.pressed : look.bg,
        opacity: pressed && variant === "danger" ? 0.85 : 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: radius.control,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        borderWidth: 1,
        borderColor: greyed ? C.disabledBg : look.border,
        ...style,
      })}
    >
      {loading ? (
        <>
          <ActivityIndicator color={color} />
          {loadingTitle ? (
            <Text style={{ color, fontWeight: "700", fontSize: 15, ...textStyle }}>{loadingTitle}</Text>
          ) : null}
        </>
      ) : (
        <>
          {icon}
          <Text style={{ color, fontWeight: "700", fontSize: 15, ...textStyle }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
};
