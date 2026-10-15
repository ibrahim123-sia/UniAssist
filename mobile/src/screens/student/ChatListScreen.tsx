import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, FlatList, Pressable, RefreshControl, Alert, Modal, TextInput,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useFocusEffect } from "@react-navigation/native";
import moment from "moment";
import { MessageSquare, Plus } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import {
  fetchChats, createChat, deleteChat, renameChat, type Chat,
} from "../../redux/slices/chatSlice";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import type { AppDispatch, RootState } from "../../redux/store";

export default function ChatListScreen({ navigation }: any) {
  const { C } = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const { chats, loading, error } = useSelector((s: RootState) => s.chat);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [renaming, setRenaming] = useState<Chat | null>(null);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  // Only a pull shows the refresh spinner, not the refetch on focus.
  const [refreshing, setRefreshing] = useState(false);

  // Refetch on focus so names the server assigned while chatting show up.
  useFocusEffect(useCallback(() => { dispatch(fetchChats()); }, [dispatch]));

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchChats());
    setRefreshing(false);
  };

  const onNewChat = async () => {
    // A double tap must not create two chats.
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    const r = await dispatch(createChat());
    creatingRef.current = false;
    setCreating(false);
    if (createChat.fulfilled.match(r)) navigation.navigate("Chat", { id: r.payload._id });
    else Alert.alert("Failed", (r.payload as string) || "Couldn't start a new chat.");
  };

  const onLongPress = (chat: Chat) =>
    Alert.alert(chat.name || "Chat", undefined, [
      { text: "Rename", onPress: () => { setNewName(chat.name || ""); setRenaming(chat); } },
      { text: "Delete", style: "destructive", onPress: () => confirmDelete(chat) },
      { text: "Cancel", style: "cancel" },
    ]);

  const confirmDelete = (chat: Chat) =>
    Alert.alert("Delete this chat?", `"${chat.name || "New Chat"}" and its messages will be deleted.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const r = await dispatch(deleteChat(chat._id));
          if (deleteChat.rejected.match(r)) Alert.alert("Failed", r.payload as string);
        },
      },
    ]);

  const submitRename = async () => {
    const name = newName.trim();
    if (!renaming || !name || savingName) return;
    setSavingName(true);
    const r = await dispatch(renameChat({ id: renaming._id, name }));
    setSavingName(false);
    if (renameChat.rejected.match(r)) Alert.alert("Failed", r.payload as string);
    setRenaming(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: C.muted, fontSize: 12, flex: 1 }}>Long-press a chat to rename or delete it.</Text>
        <Button title="New" onPress={onNewChat} loading={creating}
          icon={<Plus color={C.onPrimary} size={16} />} style={{ paddingVertical: 8 }} />
      </View>

      {error && chats.length === 0 ? (
        <Text style={{ color: C.danger, marginHorizontal: 14 }}>{error}. Pull down to retry.</Text>
      ) : null}

      <FlatList
        data={chats}
        keyExtractor={(c) => c._id}
        renderItem={({ item }) => {
          const last = item.messages?.[item.messages.length - 1];
          return (
            <Pressable
              onPress={() => navigation.navigate("Chat", { id: item._id })}
              onLongPress={() => onLongPress(item)}
              style={{ marginHorizontal: 14 }}
            >
              <Card style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <MessageSquare color={C.muted} size={16} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: "600" }} numberOfLines={1}>
                      {item.name || "New Chat"}
                    </Text>
                    {last ? (
                      <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                        {last.content}
                      </Text>
                    ) : null}
                    <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                      {moment(item.updatedAt).fromNow()}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading || error ? null : (
            <EmptyState icon={<MessageSquare color={C.muted} size={48} />}
              title="No chats yet" description="Tap New to start chatting with UniAssist." />
          )
        }
        contentContainerStyle={{ paddingBottom: 30 }}
      />

      <Modal visible={!!renaming} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.heading, fontWeight: "800", fontSize: 16, marginBottom: 12 }}>Rename chat</Text>
            <TextInput value={newName} onChangeText={setNewName} maxLength={100} autoFocus
              placeholderTextColor={C.placeholder} placeholder="Chat name"
              style={{
                backgroundColor: C.inputBg, color: C.text, borderColor: C.inputBorder, borderWidth: 1,
                borderRadius: 12, padding: 12, marginBottom: 14,
              }} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button title="Cancel" variant="ghost" onPress={() => setRenaming(null)} style={{ flex: 1 }} />
              <Button title="Save" onPress={submitRename} loading={savingName} loadingTitle="Saving…"
                disabled={!newName.trim()} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
