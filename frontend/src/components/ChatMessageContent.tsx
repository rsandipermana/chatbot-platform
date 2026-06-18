import ReactMarkdown from 'react-markdown'
import { cn } from '../lib/utils'

interface ChatMessageContentProps {
  content: string
  variant?: 'user' | 'assistant'
}

export function ChatMessageContent({ content, variant = 'assistant' }: ChatMessageContentProps) {
  if (variant === 'user') {
    return <span className="whitespace-pre-wrap">{content}</span>
  }

  return (
    <div className={cn('chat-markdown', 'chat-markdown-assistant')}>
      <ReactMarkdown
        components={{
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="mb-3 last:mb-0 ml-4 list-disc space-y-1.5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 last:mb-0 ml-4 list-decimal space-y-1.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h3 className="font-semibold text-base mb-2 mt-1">{children}</h3>,
        h2: ({ children }) => <h4 className="font-semibold text-sm mb-2 mt-1">{children}</h4>,
        h3: ({ children }) => <h5 className="font-semibold text-sm mb-1.5 mt-1">{children}</h5>,
        code: ({ children }) => (
          <code className="px-1.5 py-0.5 rounded-md bg-surface text-accent text-[0.85em] font-mono">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="mb-3 last:mb-0 p-3 rounded-xl bg-surface border border-border overflow-x-auto text-xs font-mono">
            {children}
          </pre>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-hover underline underline-offset-2"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 last:mb-0 pl-3 border-l-2 border-accent/40 text-text-muted italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-border-subtle" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
