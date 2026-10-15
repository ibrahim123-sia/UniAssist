import React from "react";
import { Pressable, View, Text } from "react-native";
import moment from "moment";
import { useTheme } from "../hooks/useTheme";
import { radius, tone, type Palette, type Tone } from "../theme/palette";

// Same mapping as the web: Pending = warning, In Progress = info,
// Resolved/Closed = success, Rejected = danger.
const STATUS_TONE: Record<string, Tone> = {
  Pending: "warning",
  "In Progress": "info",
  Resolved: "success",
  Closed: "success",
  Rejected: "danger",
};

export const statusTone = (status: string, C: Palette) => tone(C, STATUS_TONE[status] || "neutral");

export const IssueCard: React.FC<{ issue: any; onPress?: () => void }> = ({ issue, onPress }) => {
  const { C } = useTheme();
  const st = statusTone(issue.status, C);
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
        borderColor: C.border, borderWidth: 1, borderRadius: radius.card,
        padding: 14, marginBottom: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <Text style={{ color: C.heading, fontWeight: "700", fontSize: 15, flex: 1 }} numberOfLines={1}>
          {issue.title}
        </Text>
        <View
          style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
            backgroundColor: st.bg, borderWidth: 1, borderColor: st.border,
          }}
        >
          <Text style={{ color: st.text, fontSize: 10, fontWeight: "700" }}>{issue.status}</Text>
        </View>
      </View>
      <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
        {issue.description}
      </Text>
      <Text style={{ color: C.muted, fontSize: 11, marginTop: 8 }} numberOfLines={1}>{meta}</Text>
    </Pressable>
  );
};
