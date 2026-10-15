import React, { memo } from 'react';
import Markdown from 'react-markdown';
import { isHttpUrl } from '../utils/listings';

// react-markdown passes its AST `node` to custom components; keep it off the DOM.
const domProps = (props) => {
  const rest = { ...props };
  delete rest.node;
  return rest;
};

// Tailwind's preflight strips list markers and
// spacing; restore them so fee breakdowns / requirement lists read as lists.
const baseComponents = {
  ul: (props) => <ul className="list-disc pl-5 my-1 space-y-0.5" {...domProps(props)} />,
  ol: (props) => <ol className="list-decimal pl-5 my-1 space-y-0.5" {...domProps(props)} />,
  p: (props) => <p className="my-1" {...domProps(props)} />,
  // Links from the model open in a new tab and can't reach back into this
  // page; anything that isn't http(s) (javascript:, data:...) renders as text.
  a: ({ href, children, ...props }) =>
    isHttpUrl(href) ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ai-bubble-link underline underline-offset-2 wrap-break-word"
        {...domProps(props)}
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
};

// Built once at module load: passing a fresh `components` object (with new
// function identities) on every render made React unmount and remount every
// paragraph/list of every message on each parent render. Code colors come
// from theme tokens, so one set serves both modes.
const COMPONENTS = {
  ...baseComponents,
  code: ({ className, children, ...props }) => (
    <code
      className={[className, 'px-1 py-0.5 rounded bg-surface-muted text-text text-sm'].filter(Boolean).join(' ')}
      {...domProps(props)}
    >
      {children}
    </code>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="p-3 rounded-control overflow-x-auto my-2 text-sm bg-surface-muted text-text border border-border"
      {...domProps(props)}
    >
      {children}
    </pre>
  ),
};

// Shared by the student chat and the guest chat. react-markdown escapes raw
// HTML by default (no rehype-raw), so model output can't inject markup.
// Memoised: re-parsing markdown is the expensive part of rendering a message,
// so it only happens when the text actually changes.
const MarkdownContent = ({ content }) => (
  <Markdown components={COMPONENTS}>{content}</Markdown>
);

export default memo(MarkdownContent);
