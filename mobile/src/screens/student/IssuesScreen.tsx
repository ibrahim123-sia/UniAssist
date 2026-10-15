import React, { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Plus, AlertCircle } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { useFocusPolling } from "../../hooks/useFocusPolling";
import { fetchMyIssues } from "../../redux/slices/issueSlice";
import { IssueCard } from "../../components/IssueCard";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import type { AppDispatch, RootState } from "../../redux/store";

export default function IssuesScreen({ navigation }: any) {
  const { C } = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const { mine, mineLoading, mineError } = useSelector((s: RootState) => s.issue);
  const userId = useSelector((s: RootState) => s.auth.user?._id);
  // Only this student's queued issues (another account's never show here).
  const outbox = useSelector((s: RootState) => s.outbox.items).filter((i) => !i.userId || i.userId === userId);
  // Only a pull shows the refresh spinner, not the background poll.
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => { dispatch(fetchMyIssues()); }, [dispatch]);
  useFocusPolling(load, 20000);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchMyIssues());
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: C.muted, fontSize: 12, flex: 1 }}>Questions and complaints you sent to departments.</Text>
        <Button title="New" onPress={() => navigation.navigate("NewIssue")}
          icon={<Plus color={C.onPrimary} size={16} />} style={{ paddingVertical: 8 }} />
      </View>

      {outbox.length > 0 && (
        <View style={{ marginHorizontal: 14, marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: C.warningBg, borderWidth: 1, borderColor: C.warningBorder }}>
          <Text style={{ color: C.warning, fontSize: 12 }}>
            {outbox.length} issue{outbox.length > 1 ? "s" : ""} queued and will be sent when you're back online.
          </Text>
        </View>
      )}
      {mineError && mine.length === 0 ? (
        <Text style={{ color: C.danger, marginHorizontal: 14, marginBottom: 8 }}>{mineError}. Pull down to retry.</Text>
      ) : null}

      <FlatList
        data={mine}
        keyExtractor={(i: any) => i._id}
        renderItem={({ item }) => (
          <IssueCard issue={item} onPress={() => navigation.navigate("IssueDetail", { id: item._id })} />
        )}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          mineLoading && mine.length === 0 ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: 30 }} />
          ) : mineError ? null : (
            <EmptyState icon={<AlertCircle color={C.muted} size={48} />}
              title="No issues yet"
              description="Tap New to send a question or complaint to the right department." />
          )
        }
      />
    </View>
  );
}
