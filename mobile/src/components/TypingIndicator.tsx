import React, { useEffect, useRef } from "react";
import { Animated, View, Text } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { useElapsed } from "../hooks/useElapsed";

// Same time-based stages as the web chat while one reply is awaited.
export const replyStage = (seconds: number): string | null =>
  seconds >= 15 ? "Still working — the AI service is busy, this can take up to a minute."
    : seconds >= 6 ? "Writing the answer…"
    : seconds >= 2 ? "Searching the knowledge base…"
    : null;

const Dot: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const v = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: v }} />;
};

// Typing dots in an assistant-style bubble plus the current stage line and
// elapsed seconds, from `startedAt` (ms) of the pending send.
export const TypingIndicator: React.FC<{ startedAt: number }> = ({ startedAt }) => {
  const { C } = useTheme();
  const seconds = useElapsed(startedAt);
  const stage = replyStage(seconds);
  return (
    <View style={{ marginHorizontal: 12, marginVertical: 4 }}
      accessibilityLiveRegion="polite" accessibilityLabel={stage || "UniAssist is typing"}>
      <View style={{
        alignSelf: "flex-start", flexDirection: "row", gap: 5, paddingHorizontal: 14, paddingVertical: 12,
        borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
      }}>
        <Dot delay={0} color={C.muted} />
        <Dot delay={200} color={C.muted} />
        <Dot delay={400} color={C.muted} />
      </View>
      {stage ? (
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 4, marginLeft: 2 }}>
          {stage} {seconds} s
        </Text>
      ) : null}
    </View>
  );
};
