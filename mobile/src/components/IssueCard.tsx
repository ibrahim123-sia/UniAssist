import React from "react";
import { Pressable, View, Text } from "react-native";
import moment from "moment";
import { useTheme } from "../hooks/useTheme";
import type { Palette } from "../theme/palette";

// Theme-aware so every status stays readable on the dark surfaces too.
export const statusColor = (status: string, C: Palette): string =>
  ({
    Pending: C.amber,
    "In Progress": C.info,
    Resolved: C.green,
    Closed: C.muted,
    Rejected: C.red,
  } as Record<string, string>)[status] || C.muted;

export const IssueCard: React.FC<{ issue: any; onPress?: () => void }> = ({ issue, onPress }) => {
  const { C } = useTheme();
  const color = statusColor(issue.status, C);
  const meta = [
    moment(issue.updatedAt || issue.createdAt).fromNow(),
    issue.department?.code,
    issue.category,
    issue.assignedTo?.name ? `→ ${issue.assignedTo.name}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${issue.title}, ${issue.status}`}
      style={({ pressed }) => ({
        backgroundColor: C.surface,
        borderColor: C.border, borderWidth: 1, borderRadius: 12,
        padding: 14, marginBottom: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, flex: 1 }} numberOfLines={1}>
          {issue.title}
        </Text>
        <View
          style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
            backgroundColor: `${color}26`, borderWidth: 1, borderColor: `${color}66`,
          }}
        >
          <Text style={{ color, fontSize: 10, fontWeight: "700" }}>{issue.status}</Text>
        </View>
      </View>
      <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
        {issue.description}
      </Text>
      <Text style={{ color: C.muted, fontSize: 11, marginTop: 8 }} numberOfLines={1}>{meta}</Text>
    </Pressable>
  );
};
