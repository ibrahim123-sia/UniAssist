import React, { useState } from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { radius } from "../theme/palette";

interface Props extends TextInputProps {
  label: string;
  hint?: string;
}

export const Input: React.FC<Props> = ({ label, hint, style, onFocus, onBlur, ...rest }) => {
  const { C } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: C.label, fontSize: 13, fontWeight: "600", marginBottom: 7 }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={C.placeholder}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[{
          backgroundColor: C.inputBg, color: C.text,
          borderColor: focused ? C.primary : C.inputBorder, borderWidth: 1,
          borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
        }, style]}
        {...rest}
      />
      {hint ? <Text style={{ color: C.muted, fontSize: 12, marginTop: 5 }}>{hint}</Text> : null}
    </View>
  );
};
