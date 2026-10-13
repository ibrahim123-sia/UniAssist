import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

// Runs `fn` when the screen gains focus (or `fn` changes, e.g. a new filter
// or route id) and every `ms` while it stays focused. Tab screens stay
// mounted in the background, so a plain useEffect interval would keep
// polling from tabs nobody is looking at. `fn` must be memoised.
export const useFocusPolling = (fn: () => void, ms: number) => {
  useFocusEffect(
    useCallback(() => {
      fn();
      const id = setInterval(fn, ms);
      return () => clearInterval(id);
    }, [fn, ms])
  );
};
