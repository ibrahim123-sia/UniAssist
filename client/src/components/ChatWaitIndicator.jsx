import React from "react";
import { useElapsed } from "../utils/useElapsed";

// What the bot is (probably) doing, by how long the single /ask request has
// been running. Time-based on purpose: the reply is one HTTP request, so
// there are no real stage events to show.
const chatWaitStage = (seconds) => {
  if (seconds < 2) return "";
  if (seconds < 6) return "Searching the knowledge base…";
  if (seconds < 15) return "Writing the answer…";
  return "Still working — the AI service is busy, this can take up to a minute.";
};

// Typing indicator shown while waiting for the assistant's reply (student
// and guest chat). Owns its own 1 s clock so only this small component
// re-renders while waiting, never the message list.
const ChatWaitIndicator = ({ startedAt }) => {
  const seconds = useElapsed(startedAt);
  const stage = chatWaitStage(seconds);

  return (
    <div className="flex justify-start my-3" role="status" aria-live="polite">
      <div className="max-w-[85%] rounded-2xl rounded-tl-[4px] px-3 py-2 bg-ai-bubble text-ai-bubble-text">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1" aria-hidden="true">
            {[0, 0.15, 0.3].map((delay) => (
              <span
                key={delay}
                className="w-2 h-2 rounded-full animate-bounce bg-accent-strong"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </span>
          <span className="sr-only">UniAssist is replying.</span>
          {stage && (
            <span className="text-xs text-muted">
              {stage}
              {seconds >= 6 && <span className="tabular-nums"> · {seconds} s</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatWaitIndicator;
