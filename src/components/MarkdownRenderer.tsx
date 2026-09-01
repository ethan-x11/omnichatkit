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
    <div className={`prose prose-sm dark:prose-invert max-w-none break-all prose-p:my-1 prose-li:my-0 prose-ul:my-2 prose-ol:my-2 text-foreground ${className || ''}`}>
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
          p(props) {
            return <p className="text-foreground">{props.children}</p>
          },
          strong(props) {
            return <strong className="font-semibold text-foreground">{props.children}</strong>
          },
          em(props) {
            return <em className="italic text-foreground">{props.children}</em>
          },
          blockquote(props) {
            return <blockquote className="border-l-2 border-slate-300 dark:border-slate-700 pl-4 italic text-foreground/80">{props.children}</blockquote>
          },
          h1(props) { return <h1 className="text-foreground font-bold text-2xl mt-6 mb-4">{props.children}</h1> },
          h2(props) { return <h2 className="text-foreground font-bold text-xl mt-5 mb-3">{props.children}</h2> },
          h3(props) { return <h3 className="text-foreground font-semibold text-lg mt-4 mb-2">{props.children}</h3> },
          h4(props) { return <h4 className="text-foreground font-semibold text-base mt-3 mb-2">{props.children}</h4> },
          li(props) {
            return <li className="text-foreground">{props.children}</li>
          },
          ul(props) {
            return <ul className="list-disc pl-5 text-foreground">{props.children}</ul>
          },
          ol(props) {
            return <ol className="list-decimal pl-5 text-foreground">{props.children}</ol>
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
              <code className={className ? `${className} text-foreground bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded-md` : "text-foreground bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded-md"}>{children}</code>
            );
          },
        }}
      />
    </div>
  );
}
