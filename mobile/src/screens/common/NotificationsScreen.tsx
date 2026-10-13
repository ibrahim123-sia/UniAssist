import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, RefreshControl, Pressable } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import moment from "moment";
import { Bell, CheckCheck } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { toast } from "../../utils/toast";
import {
  fetchNotifications, fetchUnreadCount, markRead, markAllRead,
} from "../../redux/slices/notificationSlice";
import type { AppDispatch, RootState } from "../../redux/store";

export default function NotificationsScreen({ navigation }: any) {
  const { C } = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const { items, unreadCount, loading, error } = useSelector((s: RootState) => s.notification);
  // Only a pull shows the refresh spinner, not the initial/background load.
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => Promise.all([
    dispatch(fetchNotifications()),
    dispatch(fetchUnreadCount()),
  ]), [dispatch]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = async (n: any) => {
    if (!n.isRead) {
      dispatch(markRead(n._id)).then((r) => {
        if (markRead.rejected.match(r)) toast("Couldn't mark the notification as read.");
      });
    }
    // An admin answered one of the student's chatbot questions.
    if (n.type === "question_answered") {
      navigation.navigate("MyQuestions");
      return;
    }
    if (n.issueId) navigation.navigate("IssueDetail", { id: n.issueId });
  };

  const onMarkAll = async () => {
    const r = await dispatch(markAllRead());
    if (markAllRead.rejected.match(r)) toast("Couldn't mark notifications as read. Try again.");
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: C.muted, fontSize: 12 }}>
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </Text>
        {unreadCount > 0 && (
          <Pressable onPress={onMarkAll} accessibilityRole="button"
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <CheckCheck color={C.navy} size={14} />
            <Text style={{ color: C.navy, fontSize: 12, fontWeight: "600" }}>Mark all read</Text>
          </Pressable>
        )}
      </View>
      {error && items.length === 0 ? (
        <Text style={{ color: C.red, marginHorizontal: 14 }}>{error}. Pull down to retry.</Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(n: any) => n._id}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} style={{ marginHorizontal: 14 }} accessibilityRole="button">
            <Card style={{
              marginBottom: 8,
              backgroundColor: item.isRead ? C.surface : `${C.navy}11`,
              borderColor: item.isRead ? C.border : C.navy,
            }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{
                  width: 8, height: 8, borderRadius: 4, marginTop: 6,
                  backgroundColor: item.isRead ? C.border : C.navy,
                }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: item.isRead ? "500" : "700" }}>
                    {item.message}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
                    {moment(item.createdAt).fromNow()} · {String(item.type || "").replace(/_/g, " ")}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState icon={<Bell color={C.muted} size={48} />}
              title="No notifications yet"
              description="Issue updates, replies and answers to your questions will show up here." />
          )
        }
        contentContainerStyle={{ paddingBottom: 30 }}
      />
    </View>
  );
}
