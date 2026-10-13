import React, { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import moment from "moment";
import { HelpCircle } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { useFocusPolling } from "../../hooks/useFocusPolling";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { apiMyQuestions, type StudentQuestion } from "../../api/question";
import { errorMessage } from "../../api/client";

// Questions the chatbot couldn't answer (auto-forwarded) or the student sent
// with "Ask an admin", with the admin's reply once there is one.
export default function MyQuestionsScreen() {
  const { C } = useTheme();
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Only a pull shows the spinner, not the background poll.
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiMyQuestions();
      setQuestions(data?.questions || []);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "Couldn't load your questions"));
    } finally {
      setLoaded(true);
    }
  }, []);
  useFocusPolling(load, 30000);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const STATUS: Record<string, { label: string; color: string }> = {
    open: { label: "Waiting for admin", color: C.amber },
    answered: { label: "Answered", color: C.green },
    dismissed: { label: "Closed", color: C.muted },
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {error ? (
        <Text style={{ color: C.red, marginHorizontal: 14, marginTop: 12 }}>{error}. Pull down to retry.</Text>
      ) : null}
      <FlatList
        data={questions}
        keyExtractor={(q) => q._id}
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>
            Questions sent to the university admin from the chat. You'll get a notification when they reply.
          </Text>
        }
        renderItem={({ item }) => {
          const st = STATUS[item.status] || { label: item.status, color: C.muted };
          return (
            <Card style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: `${st.color}22`,
                }}>
                  <Text style={{ color: st.color, fontSize: 11, fontWeight: "700" }}>{st.label}</Text>
                </View>
                <Text style={{ color: C.muted, fontSize: 11 }}>
                  {item.source === "auto" ? "Auto-forwarded · " : ""}{moment(item.createdAt).fromNow()}
                </Text>
              </View>
              <Text selectable style={{ color: C.text, fontWeight: "600", marginTop: 8 }}>{item.question}</Text>
              {item.status === "answered" && item.adminAnswer ? (
                <View style={{
                  marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: `${C.navy}11`,
                  borderLeftWidth: 3, borderLeftColor: C.navy,
                }}>
                  <Text style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>
                    Admin answer{item.answeredAt ? ` · ${moment(item.answeredAt).fromNow()}` : ""}
                  </Text>
                  <Text selectable style={{ color: C.text }}>{item.adminAnswer}</Text>
                </View>
              ) : null}
            </Card>
          );
        }}
        ListEmptyComponent={
          !loaded ? <ActivityIndicator color={C.navy} style={{ marginTop: 20 }} /> : error ? null : (
            <EmptyState icon={<HelpCircle color={C.muted} size={48} />}
              title="No questions yet"
              description={'Tap "Ask an admin" under a chatbot answer to send your question to the university.'} />
          )
        }
      />
    </View>
  );
}
