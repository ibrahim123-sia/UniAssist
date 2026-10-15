import React from "react";
import { View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useTheme } from "../hooks/useTheme";

// 28px square shown to the left of every assistant bubble.
export const AiAvatar: React.FC = () => {
  const { C } = useTheme();
  return (
    <View
      accessible={false}
      style={{
        width: 28, height: 28, borderRadius: 8, backgroundColor: C.accentSoft,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Sparkles color={C.accentStrong} size={15} strokeWidth={2} />
    </View>
  );
};
