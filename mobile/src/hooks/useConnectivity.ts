import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useDispatch, useSelector } from "react-redux";
import { apiCreateIssue } from "../api/issue";
import { remove } from "../redux/slices/outboxSlice";
import { fetchMyIssues } from "../redux/slices/issueSlice";
import type { RootState, AppDispatch } from "../redux/store";

// Drains the signed-in student's offline issue outbox when connectivity
// returns (and right after they sign in, since NetInfo reports the current
// state on subscribe).
export const useConnectivity = () => {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((s: RootState) => s.auth.token);
  const userId = useSelector((s: RootState) => s.auth.user?._id);
  const items = useSelector((s: RootState) => s.outbox.items);
  // Read through a ref so the NetInfo listener isn't re-subscribed on every
  // queue change — re-subscribing fires it again and used to start a second,
  // overlapping flush that posted the same issue twice.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const flushing = useRef(false);

  useEffect(() => {
    if (!token || !userId) return;

    const flush = async () => {
      // Items queued before owners were recorded belong to whoever is signed in.
      const mine = itemsRef.current.filter((i) => !i.userId || i.userId === userId);
      if (flushing.current || !mine.length) return;
      flushing.current = true;
      let sent = 0;
      let sessionEnded = false;
      const rejected: string[] = [];
      try {
        for (const it of mine) {
          const form = new FormData();
          form.append("title", it.payload.title);
          form.append("description", it.payload.description);
          form.append("category", it.payload.category);
          form.append("departmentId", it.payload.departmentId);
          try {
            await apiCreateIssue(form);
            dispatch(remove(it.id));
            sent++;
          } catch (e: any) {
            const status = e?.response?.status;
            const blocked = status === 403 && !!e?.response?.data?.blocked;
            // The session ended (expired/blocked): keep the rest for when this
            // student signs in again.
            if (status === 401 || blocked) { sessionEnded = true; break; }
            // No response = still offline; 429/5xx are transient. Stop and
            // retry on the next reconnect.
            if (!status || status === 429 || status >= 500) break;
            // Any other 4xx (e.g. the department was deactivated) will never
            // succeed — drop it and tell the user instead of retrying forever.
            dispatch(remove(it.id));
            rejected.push(`"${it.payload.title}": ${e.response?.data?.message || "rejected"}`);
          }
        }
      } finally {
        flushing.current = false;
      }
      if (sent) dispatch(fetchMyIssues());
      if (sessionEnded) {
        const left = mine.length - sent - rejected.length;
        Alert.alert(
          "Queued issues not sent yet",
          `Your session ended before ${left === 1 ? "a queued issue" : `${left} queued issues`} could be sent. ` +
            "They are kept on this device and will be sent when you sign in again."
        );
      }
      if (rejected.length) {
        Alert.alert("Some queued issues couldn't be submitted", rejected.join("\n"));
      }
    };

    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) flush();
    });
    return () => unsub();
  }, [token, userId, dispatch]);
};
