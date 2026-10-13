import React, { memo } from 'react';
import Markdown from 'react-markdown';
import { isHttpUrl } from '../utils/listings';

// react-markdown passes its AST `node` to custom components; keep it off the DOM.
const domProps = (props) => {
  const rest = { ...props };
  delete rest.node;
  return rest;
};

const CODE_COLORS = {
  light: { backgroundColor: '#F2F3F8', color: '#1F2330' },
  dark: { backgroundColor: '#0B1120', color: '#ECEEF5' },
};

// Theme-independent overrides. Tailwind's preflight strips list markers and
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
        className="underline underline-offset-2 wrap-break-word"
        {...domProps(props)}
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
};

const makeComponents = (colors) => ({
  ...baseComponents,
  code: ({ className, children, ...props }) => (
    <code
      className={[className, 'px-1 py-0.5 rounded text-sm'].filter(Boolean).join(' ')}
      style={colors}
      {...domProps(props)}
    >
      {children}
    </code>
  ),
  pre: ({ children, ...props }) => (
    <pre className="p-3 rounded-lg overflow-x-auto my-2 text-sm" style={colors} {...domProps(props)}>
      {children}
    </pre>
  ),
});

// Built once at module load: passing a fresh `components` object (with new
// function identities) on every render made React unmount and remount every
// paragraph/list of every message on each parent render.
const LIGHT_COMPONENTS = makeComponents(CODE_COLORS.light);
const DARK_COMPONENTS = makeComponents(CODE_COLORS.dark);

// Shared by the student chat and the guest chat. react-markdown escapes raw
// HTML by default (no rehype-raw), so model output can't inject markup.
// Memoised: re-parsing markdown is the expensive part of rendering a message,
// so it only happens when the text or theme actually changes.
const MarkdownContent = ({ content, isDark }) => (
  <Markdown components={isDark ? DARK_COMPONENTS : LIGHT_COMPONENTS}>{content}</Markdown>
);

export default memo(MarkdownContent);
