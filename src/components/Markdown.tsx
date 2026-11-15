import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  const components: Components = {
    h1({ children: label }) {
      return <p className="md-heading">{label}</p>;
    },
    h2({ children: label }) {
      return <p className="md-heading">{label}</p>;
    },
    h3({ children: label }) {
      return <p className="md-heading">{label}</p>;
    },
    h4({ children: label }) {
      return <p className="md-heading">{label}</p>;
    },
    a({ href, children: label }) {
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {label}
        </a>
      );
    },
    blockquote({ children: label }) {
      return <blockquote className="md-quote">{label}</blockquote>;
    },
  };

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
