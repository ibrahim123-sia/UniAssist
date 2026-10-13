import { useCallback, useEffect, useRef, useState } from "react";

export const SEARCH_DEBOUNCE_MS = 300;

// `input` drives the text box; `search` is what queries should use and only
// changes once typing pauses. `onCommit` runs in the same timer tick as that
// change, so callers can reset paging there and React batches both into a
// single render — one request per pause instead of one per keystroke (plus
// one more for the page reset).
export const useDebouncedSearch = (onCommit, delay = SEARCH_DEBOUNCE_MS) => {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  useEffect(() => {
    if (input === search) return undefined;
    const timer = setTimeout(() => {
      setSearch(input);
      onCommitRef.current?.();
    }, delay);
    return () => clearTimeout(timer);
  }, [input, search, delay]);

  // Clears both immediately (e.g. switching tabs) without waiting a tick.
  const reset = useCallback(() => {
    setInput("");
    setSearch("");
  }, []);

  return { input, setInput, search, reset };
};
