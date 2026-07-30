import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sanitizeHref } from '../markdownLinks';

export function SafeMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      className="prose-certamen"
      remarkPlugins={[remarkGfm]}
      components={{
        a({ href, children: linkChildren }) {
          const safeHref = sanitizeHref(href);
          return (
            <a href={safeHref} target="_blank" rel="noopener noreferrer nofollow">
              {linkChildren}
            </a>
          );
        }
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
