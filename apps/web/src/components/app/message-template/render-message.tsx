import { Fragment, type ReactNode } from "react";

const FORMAT_SPLIT_REGEX = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`\n]+```)/g;

export function renderFormattedMessage(text: string): ReactNode[] {
  return text.split(FORMAT_SPLIT_REGEX).map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```") && part.length >= 6) {
      return (
        <code key={i} className="rounded bg-black/10 px-1 font-mono text-[13px]">
          {part.slice(3, -3)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    }
    if (part.startsWith("_") && part.endsWith("_") && part.length >= 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("~") && part.endsWith("~") && part.length >= 2) {
      return <s key={i}>{part.slice(1, -1)}</s>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
