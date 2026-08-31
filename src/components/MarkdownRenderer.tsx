import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";

export type SourcePointer = {
  url: string;
  text_snapshot?: string;
};

export type MarkdownRendererProps = {
  text: string;
  linkedCitations?: SourcePointer[];
  className?: string;
};

export function MarkdownRenderer({ text, linkedCitations, className }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className || ''}`}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        children={text}
        components={{
          table(props) {
            const { className, children } = props;
            return (
              <table className={`w-full border-collapse ${className ?? ""}`.trim()}>
                {children}
              </table>
            );
          },
          th(props) {
            const { className, children } = props;
            return (
              <th className={`px-3 py-1 text-left align-top ${className ?? ""}`.trim()}>
                {children}
              </th>
            );
          },
          td(props) {
            const { className, children } = props;
            return (
              <td className={`px-3 py-3 align-top ${className ?? ""}`.trim()}>
                {children}
              </td>
            );
          },
          a(props) {
            const { href, children } = props;
            const pointer = linkedCitations?.find((item) => item?.url && href && item.url === href);
            const snapshot = pointer?.text_snapshot?.trim();
            return (
              <span className="relative inline-flex items-center group">
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  {children}
                </a>
                {snapshot && (
                  <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-[11px] text-slate-700 dark:text-slate-300 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                      Citation preview
                    </span>
                    <span className="block max-h-40 overflow-auto whitespace-pre-wrap leading-relaxed">
                      {snapshot}
                    </span>
                  </span>
                )}
              </span>
            );
          },
          pre(props: any) {
            const { children } = props;
            return <>{children}</>;
          },
          code(props: any) {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || "");
            return match ? (
              <SyntaxHighlighter PreTag="div" language={match[1]}>
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code className={className}>{children}</code>
            );
          },
        }}
      />
    </div>
  );
}
