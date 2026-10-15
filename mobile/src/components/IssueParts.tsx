import React from "react";
import { View, Text, Pressable, Linking, Alert } from "react-native";
import moment from "moment";
import { Paperclip, Star } from "lucide-react-native";
import { useTheme } from "../hooks/useTheme";
import { fileUrl } from "../api/client";
import { Card } from "./Card";
import { statusTone } from "./IssueCard";

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const { C } = useTheme();
  const st = statusTone(status, C);
  return (
    <View style={{
      alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
      backgroundColor: st.bg, borderWidth: 1, borderColor: st.border,
    }}>
      <Text style={{ color: st.text, fontSize: 12, fontWeight: "700" }}>{status}</Text>
    </View>
  );
};

// Files are served by the Node server at SERVER_URL + attachment.url.
export const Attachments: React.FC<{ items?: any[] }> = ({ items }) => {
  const { C } = useTheme();
  if (!items?.length) return null;
  return (
    <View style={{ marginTop: 12, gap: 6 }}>
      {items.map((a, i) => (
        <Pressable
          key={a.url || i}
          onPress={() => {
            const url = fileUrl(a.url);
            if (url) Linking.openURL(url).catch(() => Alert.alert("Couldn't open the file"));
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Paperclip color={C.link} size={13} />
          <Text style={{ color: C.link, fontSize: 12, flex: 1 }} numberOfLines={1}>
            {a.originalName || a.filename}
            {a.size ? <Text style={{ color: C.muted }}> ({Math.round(a.size / 1024)} KB)</Text> : null}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

export const ReplyList: React.FC<{ replies?: any[]; emptyText: string }> = ({ replies, emptyText }) => {
  const { C } = useTheme();
  if (!replies?.length) return <Text style={{ color: C.muted }}>{emptyText}</Text>;
  return (
    <>
      {replies.map((r, i) => {
        // A reply from the department (vs the student's own follow-up).
        const fromDept = !!r.authorRole && r.authorRole !== "student";
        return (
          <Card key={r._id || i} style={{ marginBottom: 8, borderColor: fromDept ? C.primary : C.border }}>
            <Text style={{ color: C.muted, fontSize: 11 }}>
              <Text style={{ color: C.text, fontWeight: "600" }}>{r.authorName}</Text>
              {fromDept ? "  DEPARTMENT" : ""} · {moment(r.createdAt).fromNow()}
            </Text>
            <Text selectable style={{ color: C.text, marginTop: 6 }}>{r.message}</Text>
          </Card>
        );
      })}
    </>
  );
};

// 1-5 stars; read-only without onChange.
export const StarRating: React.FC<{ value: number; onChange?: (v: number) => void; size?: number }> = ({
  value, onChange, size = 18,
}) => {
  const { C } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: onChange ? 6 : 2 }}
      accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const star = <Star size={size} color={on ? C.warning : C.muted} fill={on ? C.warning : "transparent"} />;
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={4}
            accessibilityRole="button" accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}>
            {star}
          </Pressable>
        ) : <View key={n}>{star}</View>;
      })}
    </View>
  );
};

// The student's rating/comment on a Resolved/Closed issue.
export const FeedbackView: React.FC<{ feedback?: any; title?: string }> = ({ feedback, title = "Your feedback" }) => {
  const { C } = useTheme();
  if (!feedback?.rating) return null;
  return (
    <Card style={{ marginTop: 12 }}>
      <Text style={{ color: C.heading, fontWeight: "700", marginBottom: 6 }}>{title}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <StarRating value={feedback.rating} size={16} />
        <Text style={{ color: C.muted, fontSize: 12 }}>
          {feedback.rating}/5{feedback.submittedAt ? ` · ${moment(feedback.submittedAt).fromNow()}` : ""}
        </Text>
      </View>
      {feedback.comment ? (
        <Text selectable style={{ color: C.text, marginTop: 8 }}>{feedback.comment}</Text>
      ) : null}
    </Card>
  );
};
