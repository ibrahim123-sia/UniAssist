import React, { useEffect, useState } from "react";
import { View, Image, Text } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { fileUrl } from "../api/client";

// Profile picture, or the initial when there is none or it fails to load.
export const Avatar: React.FC<{ name?: string; uri?: string; size?: number }> = ({
  name, uri, size = 40,
}) => {
  const { C } = useTheme();
  const src = fileUrl(uri);
  const [failed, setFailed] = useState(false);
  // A new picture gets a fresh chance to load.
  useEffect(() => { setFailed(false); }, [src]);
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: C.navy, alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {src && !failed ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} onError={() => setFailed(true)} />
      ) : (
        <Text style={{ color: C.onNavy, fontWeight: "700", fontSize: size * 0.45 }}>
          {(name?.trim()?.[0] || "U").toUpperCase()}
        </Text>
      )}
    </View>
  );
};
