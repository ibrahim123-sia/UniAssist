import { useEffect } from "react";
import { AppState } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { fetchUnreadCount } from "../redux/slices/notificationSlice";
import type { AppDispatch, RootState } from "../redux/store";

const POLL_MS = 30000;

// One app-wide poll for the bell badge (the bell is rendered in every tab
// header, so polling there ran one interval per mounted tab). Paused while
// the app is in the background.
export const useNotificationPolling = () => {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((s: RootState) => s.auth.token);

  useEffect(() => {
    if (!token) return;
    let active = AppState.currentState === "active";
    const tick = () => {
      if (active) dispatch(fetchUnreadCount());
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    const sub = AppState.addEventListener("change", (next) => {
      const wasActive = active;
      active = next === "active";
      if (active && !wasActive) tick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [token, dispatch]);
};
