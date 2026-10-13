import React from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";
import { useTheme } from "../hooks/useTheme";

interface Props extends TextInputProps {
  label: string;
  hint?: string;
}

export const Input: React.FC<Props> = ({ label, hint, style, ...rest }) => {
  const { C } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{
        color: C.muted, fontSize: 11, fontWeight: "600",
        textTransform: "uppercase", marginBottom: 5,
      }}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={C.muted}
        style={[{
          backgroundColor: C.input, color: C.text, borderColor: C.border, borderWidth: 1,
          borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
        }, style]}
        {...rest}
      />
      {hint ? <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{hint}</Text> : null}
    </View>
  );
};
